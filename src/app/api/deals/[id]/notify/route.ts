import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { sendSMS, formatPhoneNumber, formatDealClaimCodeSMS } from '@/lib/twilio';
import { APP_URL } from '@/lib/brand';
import { getSessionBusinessId } from '@/lib/session-business';
import { DEAL_NOTIFY_COOLDOWN_DAYS, getDealNotifyCooldownRemainingMs } from '@/lib/deal-notify';
import { claimDealForCustomer, DealClaimError } from '@/lib/deal-claims';

function normalizeNotifiedAt(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(
  _req: NextRequest,
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
            name: true,
            slug: true,
            enableOnlineBooking: true,
            vapiPhoneNumber: true,
          },
        },
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

    const cooldownRemainingMs = getDealNotifyCooldownRemainingMs(deal.notifiedAt);
    if (cooldownRemainingMs > 0) {
      const cooldownDaysRemaining = Math.ceil(cooldownRemainingMs / (24 * 60 * 60 * 1000));
      return NextResponse.json(
        {
          error: `Deal notifications are on cooldown for ${cooldownDaysRemaining} more day${cooldownDaysRemaining !== 1 ? 's' : ''}. You can send again every ${DEAL_NOTIFY_COOLDOWN_DAYS} days.`,
        },
        { status: 429 }
      );
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        smsMarketingConsent: true,
        smsOptedOut: false,
        phone: { not: null },
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

    const bookingUrl =
      deal.business.enableOnlineBooking && deal.business.slug
        ? `${APP_URL}/book/${deal.business.slug}`
        : null;

    const results = await Promise.all(
      uniqueRecipients.map(async (customer) => {
        try {
          const claim = await claimDealForCustomer({
            dealId: deal.id,
            businessId,
            customerId: customer.id,
            customerPhone: customer.phone,
            customerName: customer.name,
          });

          const smsResult = await sendSMS({
            to: customer.phone,
            from: deal.business.vapiPhoneNumber ?? null,
            message: formatDealClaimCodeSMS({
              businessName: deal.business.name,
              dealTitle: deal.title,
              dealCode: claim.code,
              customerName: customer.name,
              bookingUrl,
            }),
          });

          return {
            success: smsResult.success,
            skipped: false,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            code: claim.code,
            errorMessage: smsResult.success ? null : smsResult.error ?? 'Failed to send SMS',
          };
        } catch (error) {
          if (error instanceof DealClaimError && error.status < 500) {
            return {
              success: false,
              skipped: true,
              customerId: customer.id,
              customerName: customer.name,
              customerPhone: customer.phone,
              code: null,
              errorMessage: error.message,
            };
          }
          throw error;
        }
      })
    );

    const notificationSendLogs = results
      .filter((result) => !result.skipped && result.code)
      .map((result) => ({
        businessId,
        dealId: deal.id,
        customerId: result.customerId,
        customerName: result.customerName,
        customerPhone: result.customerPhone,
        code: result.code as string,
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
    const skipped = results.filter((r) => r.skipped).length;

    return NextResponse.json({ sent, skipped, dealId: deal.id });
  } catch (error: any) {
    console.error('POST /api/deals/[id]/notify error:', error?.message ?? error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
