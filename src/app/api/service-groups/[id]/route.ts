import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { getServiceGroupsCacheTag, getServicesCacheTag } from '@/lib/cache-tags';
import { revalidateTag } from 'next/cache';

// PATCH /api/service-groups/[id] - Rename or update sort order
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;
    const body = await request.json();
    const { name, sortOrder } = body;

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const existing = await prisma.serviceGroup.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Service group not found' }, { status: 404 });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      if (name.trim().length > 60) {
        return NextResponse.json({ error: 'Group name must be 60 characters or less' }, { status: 400 });
      }
      const blockedField = getBlockedFieldLabel([{ label: 'Service group name', value: name }]);
      if (blockedField) {
        return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
      }
    }

    const group = await prisma.serviceGroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(sortOrder !== undefined && { sortOrder: Math.max(0, Math.round(Number(sortOrder))) }),
      },
      include: { _count: { select: { services: true } } },
    });

    revalidateTag(getServiceGroupsCacheTag(business.id), 'max');
    revalidateTag(getServicesCacheTag(business.id), 'max');

    return NextResponse.json({ group });
  } catch (error) {
    console.error('Failed to update service group:', error);
    return NextResponse.json({ error: 'Failed to update service group' }, { status: 500 });
  }
}

// DELETE /api/service-groups/[id] - Delete service group
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const { id } = await params;

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const existing = await prisma.serviceGroup.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Service group not found' }, { status: 404 });
    }

    await prisma.serviceGroup.delete({
      where: { id },
    });

    revalidateTag(getServiceGroupsCacheTag(business.id), 'max');
    revalidateTag(getServicesCacheTag(business.id), 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete service group:', error);
    return NextResponse.json({ error: 'Failed to delete service group' }, { status: 500 });
  }
}
