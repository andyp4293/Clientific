import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';

// POST /api/service-groups/reorder - Update group sort order
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids is required' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const owned = await prisma.serviceGroup.findMany({
      where: { businessId: business.id, id: { in: ids } },
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
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reorder service groups:', error);
    return NextResponse.json({ error: 'Failed to reorder service groups' }, { status: 500 });
  }
}
