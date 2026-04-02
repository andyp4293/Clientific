import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import {
  CUSTOMER_GROUP_NAME_MAX_LENGTH,
  normalizeCustomerGroupName,
} from '@/lib/customer-groups';
import { revalidateTag } from 'next/cache';
import { getCustomerGroupsCacheTag } from '@/lib/cache-tags';
import { formatCustomerGroupRecord } from '@/lib/mobile-customers';

async function getOwnedGroup(businessId: string, id: string) {
  return prisma.customerGroup.findFirst({
    where: {
      id,
      businessId,
    },
    select: {
      id: true,
    },
  });
}

export async function PUT(
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
    const existing = await getOwnedGroup(authorized.session.businessId, id);

    if (!existing) {
      return NextResponse.json({ error: 'Customer group not found' }, { status: 404 });
    }

    const body = await request.json();
    const name = normalizeCustomerGroupName(body?.name);
    const promotionSmsEnabled = body?.promotionSmsEnabled !== false;

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    if (name.length > CUSTOMER_GROUP_NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Group name must be ${CUSTOMER_GROUP_NAME_MAX_LENGTH} characters or fewer` },
        { status: 400 },
      );
    }

    const duplicate = await prisma.customerGroup.findFirst({
      where: {
        businessId: authorized.session.businessId,
        id: { not: id },
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: 'A customer group with that name already exists' },
        { status: 409 },
      );
    }

    const group = await prisma.customerGroup.update({
      where: { id },
      data: {
        name,
        promotionSmsEnabled,
      },
      include: {
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });

    revalidateTag(getCustomerGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ group: formatCustomerGroupRecord(group) });
  } catch (error) {
    console.error('PUT /api/mobile/customer-groups/[id] error:', error);
    return NextResponse.json({ error: 'Unable to update customer group' }, { status: 500 });
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
    const existing = await getOwnedGroup(authorized.session.businessId, id);

    if (!existing) {
      return NextResponse.json({ error: 'Customer group not found' }, { status: 404 });
    }

    await prisma.customerGroup.delete({
      where: { id },
    });

    revalidateTag(getCustomerGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mobile/customer-groups/[id] error:', error);
    return NextResponse.json({ error: 'Unable to delete customer group' }, { status: 500 });
  }
}
