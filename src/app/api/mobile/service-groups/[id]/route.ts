import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { getServiceGroupsCacheTag, getServicesCacheTag } from '@/lib/cache-tags';
import { revalidateTag } from 'next/cache';

function formatGroup(group: {
  id: string;
  name: string;
  sortOrder: number;
  _count?: { services: number };
}) {
  return {
    id: group.id,
    name: group.name,
    sortOrder: group.sortOrder,
    servicesCount: group._count?.services ?? 0,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const { id } = await params;
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined;
    const sortOrder =
      body?.sortOrder === undefined ? undefined : Math.max(0, Math.round(Number(body.sortOrder)));

    const existing = await prisma.serviceGroup.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Service group not found' }, { status: 404 });
    }

    if (name !== undefined) {
      if (!name) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }

      if (name.length > 60) {
        return NextResponse.json(
          { error: 'Group name must be 60 characters or less' },
          { status: 400 },
        );
      }

      const blockedField = getBlockedFieldLabel([{ label: 'Service group name', value: name }]);
      if (blockedField) {
        return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
      }
    }

    const group = await prisma.serviceGroup.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
      include: { _count: { select: { services: true } } },
    });

    revalidateTag(getServiceGroupsCacheTag(authorized.session.businessId), 'max');
    revalidateTag(getServicesCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ group: formatGroup(group) });
  } catch (error) {
    console.error('PATCH /api/mobile/service-groups/[id] error:', error);
    return NextResponse.json({ error: 'Unable to update service group' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const { id } = await params;
    const existing = await prisma.serviceGroup.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Service group not found' }, { status: 404 });
    }

    await prisma.serviceGroup.delete({
      where: { id },
    });

    revalidateTag(getServiceGroupsCacheTag(authorized.session.businessId), 'max');
    revalidateTag(getServicesCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mobile/service-groups/[id] error:', error);
    return NextResponse.json({ error: 'Unable to delete service group' }, { status: 500 });
  }
}
