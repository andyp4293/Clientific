import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import {
  getServiceGroupsCacheTag,
  getServicesCacheTag,
  SHARED_REFERENCE_DATA_REVALIDATE_SECONDS,
} from '@/lib/cache-tags';
import { revalidateTag, unstable_cache } from 'next/cache';

function getCachedServiceGroups(businessId: string) {
  return unstable_cache(
    () =>
      prisma.serviceGroup.findMany({
        where: { businessId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { _count: { select: { services: true } } },
      }),
    [getServiceGroupsCacheTag(businessId)],
    {
      tags: [getServiceGroupsCacheTag(businessId)],
      revalidate: SHARED_REFERENCE_DATA_REVALIDATE_SECONDS,
    },
  )();
}

// GET /api/service-groups - Get all groups for the business
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const groups = await getCachedServiceGroups(business.id);

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Failed to fetch service groups:', error);
    return NextResponse.json({ error: 'Failed to fetch service groups' }, { status: 500 });
  }
}

// POST /api/service-groups - Create service group
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (name.length > 60) {
      return NextResponse.json({ error: 'Group name must be 60 characters or less' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([{ label: 'Service group name', value: name }]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const maxSort = await prisma.serviceGroup.aggregate({
      where: { businessId: business.id },
      _max: { sortOrder: true },
    });

    const group = await prisma.serviceGroup.create({
      data: {
        businessId: business.id,
        name,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      include: { _count: { select: { services: true } } },
    });

    revalidateTag(getServiceGroupsCacheTag(business.id), 'max');
    revalidateTag(getServicesCacheTag(business.id), 'max');

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Failed to create service group:', error);
    return NextResponse.json({ error: 'Failed to create service group' }, { status: 500 });
  }
}
