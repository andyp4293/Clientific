import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import {
  getServiceGroupsCacheTag,
  getServicesCacheTag,
} from '@/lib/cache-tags';
import { revalidateTag } from 'next/cache';

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return 'Custom price';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDuration(duration: number) {
  if (duration < 60) {
    return `${duration} min`;
  }

  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
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
    const description =
      body?.description === undefined
        ? undefined
        : typeof body.description === 'string' && body.description.trim().length > 0
          ? body.description.trim()
          : null;
    const duration =
      body?.duration === undefined ? undefined : Number.parseInt(String(body.duration), 10);
    const price =
      body?.price === undefined
        ? undefined
        : body.price === null || body.price === ''
          ? null
          : Number.parseFloat(String(body.price));
    const isActive = typeof body?.isActive === 'boolean' ? body.isActive : undefined;
    const groupId =
      body?.groupId === undefined
        ? undefined
        : typeof body.groupId === 'string' && body.groupId.trim().length > 0
          ? body.groupId.trim()
          : null;

    const blockedField = getBlockedFieldLabel([
      { label: 'Service name', value: name },
      { label: 'Service description', value: description },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    if (name !== undefined && !name) {
      return NextResponse.json({ error: 'Service name cannot be empty' }, { status: 400 });
    }

    if (duration !== undefined && (!Number.isFinite(duration) || duration < 5)) {
      return NextResponse.json({ error: 'Duration must be at least 5 minutes' }, { status: 400 });
    }

    if (
      body?.price !== undefined &&
      body?.price !== null &&
      body?.price !== '' &&
      !Number.isFinite(price ?? Number.NaN)
    ) {
      return NextResponse.json({ error: 'Price must be a valid number' }, { status: 400 });
    }

    const existingService = await prisma.service.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
      },
      select: { id: true },
    });

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    if (groupId) {
      const group = await prisma.serviceGroup.findFirst({
        where: {
          id: groupId,
          businessId: authorized.session.businessId,
        },
        select: { id: true, name: true },
      });

      if (!group) {
        return NextResponse.json({ error: 'Service group not found' }, { status: 400 });
      }
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(duration !== undefined ? { duration } : {}),
        ...(price !== undefined
          ? { price: Number.isFinite(price ?? Number.NaN) ? price : null }
          : {}),
        ...(isActive !== undefined ? { active: isActive } : {}),
        ...(groupId !== undefined ? { groupId } : {}),
      },
    });

    const groupName =
      service.groupId
        ? (
            await prisma.serviceGroup.findFirst({
              where: {
                id: service.groupId,
                businessId: authorized.session.businessId,
              },
              select: { name: true },
            })
          )?.name ?? null
        : null;

    revalidateTag(getServicesCacheTag(authorized.session.businessId), 'max');
    revalidateTag(getServiceGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({
      service: {
        id: service.id,
        name: service.name,
        description: service.description,
        duration: service.duration,
        durationLabel: formatDuration(service.duration),
        price: service.price,
        priceLabel: formatCurrency(service.price),
        isActive: service.active,
        groupId: service.groupId,
        groupName,
        sortOrder: service.sortOrder,
      },
    });
  } catch (error) {
    console.error('PATCH /api/mobile/services/[id] error:', error);
    return NextResponse.json({ error: 'Unable to update service' }, { status: 500 });
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
    const existingService = await prisma.service.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
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
        { error: 'Cannot delete service with existing appointments. Pause it instead.' },
        { status: 400 },
      );
    }

    await prisma.service.delete({
      where: { id },
    });

    revalidateTag(getServicesCacheTag(authorized.session.businessId), 'max');
    revalidateTag(getServiceGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mobile/services/[id] error:', error);
    return NextResponse.json({ error: 'Unable to delete service' }, { status: 500 });
  }
}
