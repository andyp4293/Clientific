import { NextResponse } from 'next/server';
import { requireMobileSession } from '@/lib/mobile-route';
import {
  applyRevenueCatSubscriptionSnapshot,
  buildRevenueCatAppUserId,
  fetchRevenueCatSubscriber,
  resolveRevenueCatSubscriberSnapshot,
} from '@/lib/revenuecat';
import { isSubscriptionAccessActive } from '@/lib/subscription';

function getRevenueCatSyncRetryDelaysMs() {
  if (process.env.NODE_ENV === 'test') {
    return [0, 0, 0, 0];
  }

  return [0, 1000, 2000, 4000];
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSubscriberSnapshotWithRetry(appUserId: string) {
  let lastError: unknown = null;

  for (const delayMs of getRevenueCatSyncRetryDelaysMs()) {
    await sleep(delayMs);

    try {
      const subscriber = await fetchRevenueCatSubscriber(appUserId);
      const snapshot = resolveRevenueCatSubscriberSnapshot(subscriber);

      if (snapshot) {
        return snapshot;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.warn('RevenueCat subscriber sync retries exhausted:', lastError);
  }

  return null;
}

export async function POST(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      appUserId?: string;
    };

    const expectedAppUserId = buildRevenueCatAppUserId(authorized.session.businessId);
    if (body.appUserId && body.appUserId !== expectedAppUserId) {
      return NextResponse.json(
        { error: 'App Store sync request did not match the signed-in business.', code: 'APP_STORE_APP_USER_ID_MISMATCH' },
        { status: 400 },
      );
    }

    const snapshot = await fetchSubscriberSnapshotWithRetry(expectedAppUserId);

    if (!snapshot) {
      return NextResponse.json(
        { error: 'No App Store subscription was found for this business yet.', code: 'APP_STORE_SUBSCRIPTION_NOT_FOUND' },
        { status: 409 },
      );
    }

    const result = await applyRevenueCatSubscriptionSnapshot({
      businessId: authorized.session.businessId,
      snapshot,
    });

    if (result.ownershipConflict) {
      return NextResponse.json(
        {
          error: 'This App Store subscription already belongs to a different Clientific business account.',
          code: 'APP_STORE_SUBSCRIPTION_OWNERSHIP_CONFLICT',
          ownerBusinessId: result.ownerBusinessId,
        },
        { status: 409 },
      );
    }

    if (result.conflict) {
      return NextResponse.json(
        {
          error: 'This business already has an active website subscription. App Store billing was flagged for manual review.',
          code: 'APP_STORE_SUBSCRIPTION_CONFLICT',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        plan: snapshot.plan,
        subscriptionStatus: snapshot.subscriptionStatus,
        billingProvider: snapshot.billingProvider,
        productId: snapshot.productId,
        trialEndsAt: snapshot.trialEndsAt?.toISOString() ?? null,
        subscriptionCurrentPeriodEnd:
          snapshot.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
        isActive: isSubscriptionAccessActive(
          snapshot.subscriptionStatus,
          snapshot.trialEndsAt,
          snapshot.subscriptionCurrentPeriodEnd,
        ),
      },
    });
  } catch (error) {
    console.error('POST /api/mobile/billing/sync-app-store error:', error);
    return NextResponse.json(
      { error: 'Unable to sync your App Store subscription right now.' },
      { status: 500 },
    );
  }
}
