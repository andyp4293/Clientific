import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  formatKioskDealClaimSMS,
  formatKioskSignupConfirmationSMS,
  formatPhoneNumber,
  isValidPhoneNumber,
  sendSMS,
} from '@/lib/twilio';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { claimDealForCustomer, DealClaimError } from '@/lib/deal-claims';
import { getAppBaseUrlFromRequest } from '@/lib/app-url';
import { getInStoreCaptureConfig } from '@/lib/in-store-capture';

function getClientIpAddress(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (!forwarded) return null;
  return forwarded.split(',')[0]?.trim() || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const dealId = req.nextUrl.searchParams.get('deal');
    const config = await getInStoreCaptureConfig({
      publicId,
      dealId,
      requestUrl: req.url,
    });

    if (!config) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('GET /api/public/business-by-id/[publicId]/capture error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load in-store capture page' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const { publicId } = await params;
    const body = await req.json().catch(() => ({}));

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : '';
    const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
    const dealId = typeof body.dealId === 'string' ? body.dealId.trim() : '';
    const smsMarketingConsent = body.smsMarketingConsent === true;

    if (!name || !phoneRaw) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    if (!smsMarketingConsent) {
      return NextResponse.json({ error: 'SMS consent is required' }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 1-100 characters' }, { status: 400 });
    }

    if (phoneRaw.length > 30 || !isValidPhoneNumber(phoneRaw)) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    if (emailRaw.length > 254) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([{ label: 'Customer name', value: name }]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { publicId },
      select: {
        id: true,
        name: true,
        slug: true,
        enableOnlineBooking: true,
        vapiPhoneNumber: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const normalizedPhone = formatPhoneNumber(phoneRaw);
    const now = new Date();

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        businessId: business.id,
        OR: [{ phone: normalizedPhone }, { phone: phoneRaw }],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        smsOptedOut: true,
      },
    });

    const customer = existingCustomer
      ? await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: {
            name,
            email: emailRaw || existingCustomer.email,
            smsConsent: true,
            smsMarketingConsent: true,
            smsMarketingConsentAt: now,
            smsOptedOut: false,
            smsOptedOutAt: null,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        })
      : await prisma.customer.create({
          data: {
            businessId: business.id,
            name,
            phone: normalizedPhone,
            email: emailRaw || null,
            smsConsent: true,
            smsMarketingConsent: true,
            smsMarketingConsentAt: now,
            smsOptedOut: false,
            smsOptedOutAt: null,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        });

    let claimedDeal:
      | {
          code: string;
          title: string;
          expiresAt: string;
        }
      | null = null;
    let dealIssue: string | null = null;

    if (dealId) {
      try {
        const claim = await claimDealForCustomer({
          dealId,
          businessId: business.id,
          customerId: customer.id,
        });
        claimedDeal = {
          code: claim.code,
          title: claim.deal.title,
          expiresAt: claim.expiresAt.toISOString(),
        };
      } catch (error) {
        if (error instanceof DealClaimError && error.status < 500) {
          dealIssue = error.message;
        } else {
          throw error;
        }
      }
    }

    await prisma.smsConsentEvent.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        phone: customer.phone || normalizedPhone,
        eventType: 'KIOSK_OPT_IN',
        source: 'in_store_capture',
        ipAddress: getClientIpAddress(req),
        userAgent: req.headers.get('user-agent'),
        metadata: {
          dealId: dealId || null,
          dealClaimed: Boolean(claimedDeal),
          dealIssue,
          emailProvided: Boolean(emailRaw),
          reOptIn: existingCustomer?.smsOptedOut === true,
          channel: 'ipad_capture',
        },
      },
    });

    const appBaseUrl = getAppBaseUrlFromRequest(req.url);
    const bookingUrl =
      business.enableOnlineBooking && business.slug
        ? `${appBaseUrl}/book/${business.slug}`
        : null;

    const smsMessage = claimedDeal
      ? formatKioskDealClaimSMS({
          businessName: business.name,
          customerName: customer.name,
          dealTitle: claimedDeal.title,
          dealCode: claimedDeal.code,
          bookingUrl,
        })
      : formatKioskSignupConfirmationSMS({
          businessName: business.name,
          customerName: customer.name,
          bookingUrl,
        });

    const smsResult = customer.phone
      ? await sendSMS({
          to: customer.phone,
          from: business.vapiPhoneNumber,
          message: smsMessage,
        })
      : null;

    return NextResponse.json({
      success: true,
      deal: claimedDeal,
      dealIssue,
      bookingUrl,
      confirmationSent: smsResult?.success ?? false,
      message: claimedDeal
        ? 'Promo claimed and customer enrolled for text offers.'
        : 'Customer enrolled for text offers.',
    });
  } catch (error: any) {
    console.error('POST /api/public/business-by-id/[publicId]/capture error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save in-store signup' },
      { status: 500 }
    );
  }
}
