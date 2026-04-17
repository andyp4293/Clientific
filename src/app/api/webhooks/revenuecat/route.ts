import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  applyRevenueCatSubscriptionSnapshot,
  parseRevenueCatAppUserId,
  resolveRevenueCatEventSnapshot,
  type RevenueCatWebhookEvent,
} from '@/lib/revenuecat';

function getWebhookBearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function isDuplicateWebhookError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

function unwrapRevenueCatWebhookEvent(
  payload: unknown,
): RevenueCatWebhookEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('event' in payload) {
    const nestedEvent = (payload as { event?: RevenueCatWebhookEvent | null }).event;
    return nestedEvent && typeof nestedEvent === 'object' ? nestedEvent : null;
  }

  return payload as RevenueCatWebhookEvent;
}

export async function POST(request: Request) {
  const configuredToken = process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN?.trim();
  if (configuredToken && getWebhookBearerToken(request) !== configuredToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const event = unwrapRevenueCatWebhookEvent(body);

    if (!event?.id || !event.type) {
      return NextResponse.json(
        { error: 'RevenueCat webhook event id and type are required.' },
        { status: 400 },
      );
    }

    try {
      await prisma.revenueCatWebhookEvent.create({
        data: {
          eventId: event.id,
          appUserId: event.app_user_id ?? event.original_app_user_id ?? null,
          eventType: event.type,
        },
      });
    } catch (error) {
      if (isDuplicateWebhookError(error)) {
        return NextResponse.json({ success: true, duplicate: true });
      }

      throw error;
    }

    const snapshot = resolveRevenueCatEventSnapshot(event);
    if (!snapshot) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const existingOwner = snapshot.originalTransactionId
      ? await prisma.business.findUnique({
          where: { appStoreOriginalTransactionId: snapshot.originalTransactionId },
          select: { id: true },
        })
      : null;

    const businessId =
      existingOwner?.id ??
      parseRevenueCatAppUserId(event.app_user_id) ??
      parseRevenueCatAppUserId(event.original_app_user_id);

    if (!businessId) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const result = await applyRevenueCatSubscriptionSnapshot({
      businessId,
      snapshot,
    });

    await prisma.revenueCatWebhookEvent.update({
      where: { eventId: event.id },
      data: { businessId },
    });

    if (result.ownershipConflict) {
      return NextResponse.json({
        success: true,
        ownershipConflict: true,
        ownerBusinessId: result.ownerBusinessId,
      });
    }

    if (result.conflict) {
      return NextResponse.json({ success: true, conflict: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/webhooks/revenuecat error:', error);
    return NextResponse.json(
      { error: 'Unable to process RevenueCat webhook.' },
      { status: 500 },
    );
  }
}
