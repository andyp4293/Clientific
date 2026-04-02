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

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const groups = await prisma.customerGroup.findMany({
      where: { businessId: authorized.session.businessId },
      include: {
        _count: {
          select: {
            memberships: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ groups: groups.map(formatCustomerGroupRecord) });
  } catch (error) {
    console.error('GET /api/mobile/customer-groups error:', error);
    return NextResponse.json({ error: 'Unable to load customer groups' }, { status: 500 });
  }
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

    const group = await prisma.customerGroup.create({
      data: {
        businessId: authorized.session.businessId,
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

    return NextResponse.json({ group: formatCustomerGroupRecord(group) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/mobile/customer-groups error:', error);
    return NextResponse.json({ error: 'Unable to create customer group' }, { status: 500 });
  }
}
