import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { dealRequiresPayoutSetup, getPaidDealPayoutStatus } from '@/lib/paid-deal-payouts';
import {
  sendSMS,
  formatPhoneNumber,
  formatDealClaimCodeSMS,
  formatDealPurchaseLinkSMS,
} from '@/lib/twilio';
import { getSessionBusinessId } from '@/lib/session-business';
import { claimDealForCustomer, DealClaimError } from '@/lib/deal-claims';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';

function normalizeNotifiedAt(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const businessId = getSessionBusinessId(session);
    if (!businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(businessId);
    if (subscriptionError) return subscriptionError;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            enableOnlineBooking: true,
            vapiPhoneNumber: true,
            stripeConnectAccountId: true,
            stripeConnectChargesEnabled: true,
            stripeConnectPayoutsEnabled: true,
            stripeConnectDetailsSubmitted: true,
          },
        },
        service: { select: { name: true } },
        eligibleServices: { select: { name: true } },
      },
    });

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    if (deal.businessId !== businessId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!deal.active) {
      return NextResponse.json({ error: 'Deal is not active' }, { status: 400 });
    }

    if (dealRequiresPayoutSetup(deal)) {
      const payoutStatus = getPaidDealPayoutStatus(deal.business);
      if (!payoutStatus.ready) {
        return NextResponse.json({ error: payoutStatus.message }, { status: 409 });
      }
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        smsMarketingConsent: true,
        smsOptedOut: false,
        phone: { not: null },
        OR: [
          {
            groupMemberships: {
              none: {},
            },
          },
          {
            groupMemberships: {
              some: {
                group: {
                  promotionSmsEnabled: true,
                },
              },
            },
          },
        ],
      },
      select: { id: true, phone: true, name: true },
    });

    const reservedNotifiedAt = normalizeNotifiedAt(deal.notifiedAt);
    const reservation = await prisma.deal.updateMany({
      where: {
        id: deal.id,
        notifiedAt: reservedNotifiedAt,
      },
      data: { notifiedAt: new Date() },
    });

    if (reservation.count === 0) {
      return NextResponse.json(
        { error: 'Deal notifications are already being sent. Refresh and try again in a moment.' },
        { status: 409 }
      );
    }

    const seenPhones = new Set<string>();
    const uniqueRecipients = customers.reduce<Array<{ id: string; phone: string; name: string | null }>>((acc, customer) => {
      const phone = formatPhoneNumber(customer.phone!);
      if (seenPhones.has(phone)) {
        return acc;
      }
      seenPhones.add(phone);
      acc.push({ id: customer.id, phone, name: customer.name ?? null });
      return acc;
    }, []);

    if (uniqueRecipients.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, alreadySent: 0, dealId: deal.id });
    }

    const existingNotificationSends = await prisma.dealNotificationSend.findMany({
      where: {
        dealId: deal.id,
        OR: [
          { customerId: { in: uniqueRecipients.map((customer) => customer.id) } },
          { customerPhone: { in: uniqueRecipients.map((customer) => customer.phone) } },
        ],
      },
      select: {
        customerId: true,
        customerPhone: true,
      },
    });

    const alreadySentCustomerIds = new Set(
      existingNotificationSends.flatMap((notification) =>
        notification.customerId ? [notification.customerId] : []
      )
    );
    const alreadySentPhones = new Set(
      existingNotificationSends.flatMap((notification) =>
        notification.customerPhone ? [formatPhoneNumber(notification.customerPhone)] : []
      )
    );
    const pendingRecipients = uniqueRecipients.filter(
      (customer) =>
        !alreadySentCustomerIds.has(customer.id) &&
        !alreadySentPhones.has(customer.phone)
    );

    const bookingUrl =
      deal.business.enableOnlineBooking && deal.business.slug
        ? `${getAppBaseUrlFromRequest(req.url)}/book/${deal.business.slug}`
        : null;
    const appBaseUrl = getAppBaseUrlFromRequest(req.url);

    // Resolve the service label for the SMS ("Haircut", "select services", or null for all)
    const dealServiceName: string | null =
      deal.serviceScope === 'selected_services'
        ? deal.deliveryType === 'code_claim' && deal.service?.name
          ? deal.service.name
          : deal.eligibleServices?.length === 1
            ? deal.eligibleServices[0].name
            : null // multiple selected services → "select services" via formatDealDescription
        : null; // all_services → "any service" via formatDealDescription

    const results = await Promise.all(
      pendingRecipients.map(async (customer) => {
        try {
          if (deal.deliveryType === 'purchase_link') {
            const purchaseUrl = `${appBaseUrl}/d/${deal.id}`;
            const smsResult = await sendSMS({
              to: customer.phone,
              from: deal.business.vapiPhoneNumber ?? null,
              message: formatDealPurchaseLinkSMS({
                businessName: deal.business.name,
                dealTitle: deal.title,
                dealUrl: purchaseUrl,
                customerName: customer.name,
                discountType: deal.discountType,
                discountValue: deal.discountValue,
                serviceScope: deal.serviceScope,
                serviceName: dealServiceName,
              }),
            });

            return {
              success: smsResult.success,
              skipped: false,
              alreadySent: false,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              code: null,
              purchaseUrl,
              errorMessage: smsResult.success ? null : smsResult.error ?? 'Failed to send SMS',
            };
          }

          const claim = await claimDealForCustomer({
            dealId: deal.id,
            businessId,
            customerId: customer.id,
            customerPhone: customer.phone,
            customerName: customer.name,
          });

          if (!claim.created) {
            return {
              success: false,
              skipped: false,
              alreadySent: true,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              code: null,
              errorMessage: null,
            };
          }

          const smsResult = await sendSMS({
            to: customer.phone,
            from: deal.business.vapiPhoneNumber ?? null,
            message: formatDealClaimCodeSMS({
              businessName: deal.business.name,
              dealTitle: deal.title,
              dealCode: claim.code,
              customerName: customer.name,
              bookingUrl,
              discountType: deal.discountType,
              discountValue: deal.discountValue,
              serviceScope: deal.serviceScope,
              serviceName: dealServiceName,
            }),
          });

          return {
            success: smsResult.success,
            skipped: false,
            alreadySent: false,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            code: claim.code,
            purchaseUrl: null,
            errorMessage: smsResult.success ? null : smsResult.error ?? 'Failed to send SMS',
          };
        } catch (error) {
          if (error instanceof DealClaimError && error.status < 500) {
            return {
              success: false,
              skipped: true,
              alreadySent: false,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              code: null,
              purchaseUrl: null,
              errorMessage: error.message,
            };
          }
          throw error;
        }
      })
    );

    const notificationSendLogs = results
      .filter((result) => !result.skipped && (result.code || result.purchaseUrl))
      .map((result) => ({
        businessId,
        dealId: deal.id,
        customerId: result.customerId,
        customerName: result.customerName,
        customerPhone: result.customerPhone,
        code: result.code as string | null,
        purchaseUrl: result.purchaseUrl ?? null,
        deliveryType: deal.deliveryType,
        status: result.success ? 'sent' : 'failed',
        errorMessage: result.errorMessage,
      }));

    if (notificationSendLogs.length > 0) {
      try {
        await prisma.dealNotificationSend.createMany({
          data: notificationSendLogs,
        });
      } catch (logError) {
        console.error('POST /api/deals/[id]/notify log error:', logError);
      }
    }

    const sent = results.filter((r) => r.success).length;
    const alreadySent =
      uniqueRecipients.length - pendingRecipients.length + results.filter((r) => r.alreadySent).length;
    const skipped = results.filter((r) => r.skipped).length;

    return NextResponse.json({ sent, skipped, alreadySent, dealId: deal.id });
  } catch (error: any) {
    console.error('POST /api/deals/[id]/notify error:', error?.message ?? error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
