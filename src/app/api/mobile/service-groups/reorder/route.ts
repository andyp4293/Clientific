import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { getServiceGroupsCacheTag } from '@/lib/cache-tags';
import { revalidateTag } from 'next/cache';

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

    const body = (await request.json()) as { ids?: unknown };
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string')
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids is required' }, { status: 400 });
    }

    const owned = await prisma.serviceGroup.findMany({
      where: {
        businessId: authorized.session.businessId,
        id: { in: ids },
      },
      select: { id: true },
    });

    if (owned.length !== ids.length) {
      return NextResponse.json({ error: 'One or more groups are invalid' }, { status: 400 });
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.serviceGroup.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    revalidateTag(getServiceGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/mobile/service-groups/reorder error:', error);
    return NextResponse.json({ error: 'Unable to reorder service groups' }, { status: 500 });
  }
}
