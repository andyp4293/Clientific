import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import {
  isDealEndSameOrBeforeStart,
  isDealStartBeforeToday,
  parseDealDate,
} from '@/lib/deal-dates';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;
    const body = await req.json();

    const blockedField = getBlockedFieldLabel([
      { label: 'Deal title', value: body.title },
      { label: 'Deal description', value: body.description },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing || existing.businessId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let parsedStartsAt: Date | undefined;
    if (body.startsAt !== undefined) {
      const parsed = parseDealDate(body.startsAt, false);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid deal dates' }, { status: 400 });
      }
      parsedStartsAt = parsed;
    }
    if (parsedStartsAt && isDealStartBeforeToday(parsedStartsAt)) {
      return NextResponse.json({ error: 'Start date cannot be earlier than today' }, { status: 400 });
    }

    let parsedExpiresAt: Date | undefined;
    if (body.expiresAt !== undefined) {
      const parsed = parseDealDate(body.expiresAt, true);
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid deal dates' }, { status: 400 });
      }
      parsedExpiresAt = parsed;
    }

    const nextStartsAt = parsedStartsAt ?? existing.startsAt;
    const nextExpiresAt = parsedExpiresAt ?? existing.expiresAt;
    if (isDealEndSameOrBeforeStart(nextStartsAt, nextExpiresAt)) {
      return NextResponse.json({ error: 'End date must be at least one day after start date' }, { status: 400 });
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.discountType !== undefined && { discountType: body.discountType }),
        ...(body.discountValue !== undefined && { discountValue: Number(body.discountValue) }),
        ...(body.serviceId !== undefined && { serviceId: body.serviceId || null }),
        ...(parsedStartsAt !== undefined && { startsAt: parsedStartsAt }),
        ...(parsedExpiresAt !== undefined && { expiresAt: parsedExpiresAt }),
        ...(body.maxRedemptions !== undefined && { maxRedemptions: body.maxRedemptions ? Number(body.maxRedemptions) : null }),
      },
      include: { service: { select: { name: true } } },
    });

    return NextResponse.json({ deal });
  } catch (error: any) {
    console.error('PATCH /api/deals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update deal' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.id);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;

    const existing = await prisma.deal.findUnique({ where: { id } });
    if (!existing || existing.businessId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.deal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/deals/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete deal' }, { status: 500 });
  }
}
