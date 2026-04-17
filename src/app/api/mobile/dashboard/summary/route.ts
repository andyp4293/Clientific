import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeBillingProvider } from '@/lib/billing-provider';
import { isSubscriptionAccessActive } from '@/lib/subscription';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { getReferralSharingStatus } from '@/lib/referral-sharing';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { localToUTC } from '@/lib/timezone';

function formatLocalDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('/', '-');
}

function formatTimeLabel(isoString: string, timezone: string) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
      select: {
        id: true,
        email: true,
        name: true,
        businessType: true,
        timezone: true,
        trialEndsAt: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        stripeConnectAccountId: true,
        stripeConnectChargesEnabled: true,
        stripeConnectPayoutsEnabled: true,
        stripeConnectDetailsSubmitted: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        billingProvider: true,
        subscriptionCurrentPeriodEnd: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayKey = formatLocalDate(new Date(), business.timezone);
    const startOfToday = localToUTC(todayKey, 0, 0, business.timezone);
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    const referralSharing = getReferralSharingStatus(business);
    const billingProvider = normalizeBillingProvider(business.billingProvider);
    const hasActiveSubscription = isSubscriptionAccessActive(
      business.subscriptionStatus,
      business.trialEndsAt,
      business.subscriptionCurrentPeriodEnd,
    );

    const [checkInsToday, appointmentsToday, activeReferrals, pendingReferrals, earnedCredits] =
      await Promise.all([
        prisma.checkIn.count({
          where: { businessId: business.id, checkInTime: { gte: startOfToday, lte: endOfToday } },
        }),
        prisma.appointment.findMany({
          where: {
            businessId: business.id,
            startTime: { gte: startOfToday, lte: endOfToday },
            status: { in: ['pending', 'scheduled', 'confirmed'] },
          },
          orderBy: { startTime: 'asc' },
          take: 5,
          include: {
            customer: { select: { name: true } },
            service: { select: { name: true } },
          },
        }),
        prisma.referral.count({
          where: {
            referrerId: business.id,
            status: { in: ['active', 'credited'] },
          },
        }),
        prisma.referral.count({
          where: {
            referrerId: business.id,
            status: 'pending',
          },
        }),
        prisma.referralCommission.aggregate({
          where: {
            referral: {
              referrerId: business.id,
            },
          },
          _sum: {
            amountDollars: true,
          },
        }),
      ]);

    const trialDaysRemaining = business.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(business.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    const lifetimeCredits = earnedCredits._sum.amountDollars ?? 0;

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      subscription: {
        plan: business.subscriptionPlan,
        status: business.subscriptionStatus,
        billingProvider,
        isActive: hasActiveSubscription,
        requiresPurchase: !hasActiveSubscription,
      },
      metrics: [
        {
          label: 'Booked today',
          value: String(appointmentsToday.length),
          helper: appointmentsToday.length === 1 ? 'Appointment' : 'Appointments',
        },
        {
          label: 'Checked in',
          value: String(checkInsToday),
          helper: 'Guests today',
        },
        {
          label: 'Active referrals',
          value: String(activeReferrals),
          helper: pendingReferrals > 0 ? `${pendingReferrals} in setup` : 'Ready to earn',
        },
        {
          label: 'Earned',
          value: formatCurrency(lifetimeCredits),
          helper: 'Referral credits',
        },
      ],
      todayAppointments: appointmentsToday.map((appointment) => ({
        id: appointment.id,
        customerName: appointment.customer.name,
        serviceName: appointment.service?.name ?? 'Service',
        status: appointment.status,
        startTimeLabel: formatTimeLabel(appointment.startTime.toISOString(), business.timezone),
      })),
      referralSnapshot: {
        activeCount: activeReferrals,
        pendingCount: pendingReferrals,
        lifetimeCredits,
        payoutReady: referralSharing.ready,
        setupMessage: referralSharing.ready ? null : referralSharing.message,
      },
      trialDaysRemaining,
    });
  } catch (error) {
    console.error('GET /api/mobile/dashboard/summary error:', error);
    return NextResponse.json({ error: 'Unable to load mobile home' }, { status: 500 });
  }
}
