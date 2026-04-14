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

export async function POST(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const subscriptionError = await requireActiveSubscription(authorized.session.businessId);
    if (subscriptionError) {
      return subscriptionError;
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
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

    const maxSort = await prisma.serviceGroup.aggregate({
      where: { businessId: authorized.session.businessId },
      _max: { sortOrder: true },
    });

    const group = await prisma.serviceGroup.create({
      data: {
        businessId: authorized.session.businessId,
        name,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      include: { _count: { select: { services: true } } },
    });

    revalidateTag(getServiceGroupsCacheTag(authorized.session.businessId), 'max');
    revalidateTag(getServicesCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ group: formatGroup(group) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/mobile/service-groups error:', error);
    return NextResponse.json({ error: 'Unable to create service group' }, { status: 500 });
  }
}
