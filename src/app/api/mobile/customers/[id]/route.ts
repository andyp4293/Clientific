import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { requireActiveSubscription } from '@/lib/subscription';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeCustomerGroupIds } from '@/lib/customer-groups';
import { formatPhoneNumber } from '@/lib/utils';
import { buildCustomerPhoneData, buildCustomerPhoneMatchClauses } from '@/lib/phone';
import { revalidateTag } from 'next/cache';
import { getCustomerGroupsCacheTag } from '@/lib/cache-tags';
import { formatMobileCustomerDetail } from '@/lib/mobile-customers';

async function findOwnedCustomer(businessId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: {
      id: customerId,
      businessId,
    },
    include: {
      _count: {
        select: {
          checkIns: true,
          appointments: true,
        },
      },
      checkIns: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      appointments: {
        orderBy: { startTime: 'desc' },
        take: 10,
        include: {
          service: {
            select: {
              name: true,
            },
          },
          staff: {
            select: {
              fullName: true,
            },
          },
        },
      },
      groupMemberships: {
        include: {
          group: {
            select: {
              id: true,
              name: true,
              promotionSmsEnabled: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    const { id } = await params;
    const customer = await findOwnedCustomer(authorized.session.businessId, id);

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ customer: formatMobileCustomerDetail(customer) });
  } catch (error) {
    console.error('GET /api/mobile/customers/[id] error:', error);
    return NextResponse.json({ error: 'Unable to load customer details' }, { status: 500 });
  }
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
    const existing = await prisma.customer.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    const birthday = typeof body?.birthday === 'string' ? body.birthday.trim() : '';
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
    const dealSmsBlocked = body?.dealSmsBlocked === true;
    const groupIds = normalizeCustomerGroupIds(body?.groupIds);

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const blockedField = getBlockedFieldLabel([
      { label: 'Customer name', value: name },
      { label: 'Notes', value: notes },
    ]);
    if (blockedField) {
      return NextResponse.json({ error: blockedContentError(blockedField) }, { status: 400 });
    }

    const formattedPhone = phone ? formatPhoneNumber(phone) : null;
    const phoneData = buildCustomerPhoneData(phone);

    if (email || formattedPhone) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          businessId: authorized.session.businessId,
          id: { not: id },
          OR: [
            email ? { email } : {},
            ...(formattedPhone ? buildCustomerPhoneMatchClauses(formattedPhone) : []),
          ].filter((entry) => Object.keys(entry).length > 0),
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Another customer with this email or phone already exists' },
          { status: 400 },
        );
      }
    }

    if (groupIds.length > 0) {
      const validGroups = await prisma.customerGroup.findMany({
        where: {
          businessId: authorized.session.businessId,
          id: { in: groupIds },
        },
        select: { id: true },
      });

      if (validGroups.length !== groupIds.length) {
        return NextResponse.json(
          { error: 'One or more selected customer groups are invalid' },
          { status: 400 },
        );
      }
    }

    await prisma.customer.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: phoneData.phone,
        phoneLookupKey: phoneData.phoneLookupKey,
        birthday: birthday ? new Date(birthday) : null,
        notes: notes || null,
        dealSmsBlocked,
        groupMemberships: {
          deleteMany: {},
          ...(groupIds.length > 0
            ? {
                create: groupIds.map((groupId) => ({ groupId })),
              }
            : {}),
        },
      },
    });

    const customer = await findOwnedCustomer(authorized.session.businessId, id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    revalidateTag(`dashboard-stats-${authorized.session.businessId}`, 'max');
    revalidateTag(getCustomerGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ customer: formatMobileCustomerDetail(customer) });
  } catch (error) {
    console.error('PUT /api/mobile/customers/[id] error:', error);
    return NextResponse.json({ error: 'Unable to update customer' }, { status: 500 });
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
    const existing = await prisma.customer.findFirst({
      where: {
        id,
        businessId: authorized.session.businessId,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    await prisma.customer.delete({
      where: { id },
    });

    revalidateTag(`dashboard-stats-${authorized.session.businessId}`, 'max');
    revalidateTag(getCustomerGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/mobile/customers/[id] error:', error);
    return NextResponse.json({ error: 'Unable to delete customer' }, { status: 500 });
  }
}
