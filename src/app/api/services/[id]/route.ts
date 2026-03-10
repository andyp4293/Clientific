import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';

// PATCH /api/services/[id] - Update a service
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
    const { name, description, duration, price, isActive, groupId, sortOrder } = body;

    const blockedField = getBlockedFieldLabel([
      { label: 'Service name', value: name },
      { label: 'Service description', value: description },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (name !== undefined && !name.trim()) {
      return NextResponse.json(
        { error: 'Service name cannot be empty' },
        { status: 400 }
      );
    }

    if (duration !== undefined && duration < 5) {
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

    const existingService = await prisma.service.findFirst({
      where: {
        id,
        businessId: business.id,
      },
      select: { id: true },
    });

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
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

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(duration !== undefined && { duration: parseInt(duration) }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null }),
        ...(isActive !== undefined && { active: isActive }),
        ...(groupId !== undefined && { groupId: groupId || null }),
        ...(sortOrder !== undefined && { sortOrder: Math.max(0, Math.round(Number(sortOrder))) }),
      },
    });

    const serviceWithIsActive = {
      ...service,
      isActive: service.active,
    };

    return NextResponse.json({ service: serviceWithIsActive });
  } catch (error) {
    console.error('Failed to update service:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

// DELETE /api/services/[id] - Delete a service
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

    const existingService = await prisma.service.findFirst({
      where: {
        id,
        businessId: business.id,
      },
      select: { id: true },
    });

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const appointmentCount = await prisma.appointment.count({
      where: { serviceId: id },
    });

    if (appointmentCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete service with existing appointments. Consider deactivating it instead.' },
        { status: 400 }
      );
    }

    await prisma.service.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete service:', error);
    return NextResponse.json(
      { error: 'Failed to delete service' },
      { status: 500 }
    );
  }
}
