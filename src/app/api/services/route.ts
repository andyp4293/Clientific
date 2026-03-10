import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription, checkPlanLimit } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

// GET /api/services - Get all services for the business
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

    const services = await prisma.service.findMany({
      where: { businessId: business.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const servicesWithIsActive = services.map((service) => ({
      ...service,
      isActive: service.active,
    }));

    return NextResponse.json({ services: servicesWithIsActive });
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}

// POST /api/services - Create a new service
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionError = await requireActiveSubscription(session.user.businessId);
    if (subscriptionError) return subscriptionError;

    const limitCheck = await checkPlanLimit(session.user.businessId, 'services');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: `Service limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.`, code: 'PLAN_LIMIT_REACHED' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, duration, price, isActive, groupId, sortOrder } = body;

    if (!name || !duration) {
      return NextResponse.json(
        { error: 'Name and duration are required' },
        { status: 400 }
      );
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Service name', value: name },
      { label: 'Service description', value: description },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (duration < 5) {
      return NextResponse.json(
        { error: 'Duration must be at least 5 minutes' },
        { status: 400 }
      );
    }

    const business = await prisma.business.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (groupId !== undefined && groupId !== null) {
      const group = await prisma.serviceGroup.findFirst({
        where: { id: groupId, businessId: business.id },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json({ error: 'Service group not found' }, { status: 400 });
      }
    }

    const maxSort = await prisma.service.aggregate({
      where: { businessId: business.id },
      _max: { sortOrder: true },
    });
    const nextSortOrder = typeof sortOrder === 'number'
      ? Math.max(0, Math.round(sortOrder))
      : (maxSort._max.sortOrder ?? -1) + 1;

    const service = await prisma.service.create({
      data: {
        businessId: business.id,
        groupId: groupId || null,
        name: name.trim(),
        description: description?.trim() || null,
        duration: parseInt(duration),
        price: price ? parseFloat(price) : null,
        active: isActive !== undefined ? isActive : true,
        sortOrder: nextSortOrder,
      },
    });

    const serviceWithIsActive = {
      ...service,
      isActive: service.active,
    };

    return NextResponse.json({ service: serviceWithIsActive }, { status: 201 });
  } catch (error) {
    console.error('Failed to create service:', error);
    return NextResponse.json(
      { error: 'Failed to create service' },
      { status: 500 }
    );
  }
}
