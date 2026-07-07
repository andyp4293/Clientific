import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileSession } from '@/lib/mobile-route';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { buildCustomerWhereClause } from '@/lib/customer-filters';
import { formatPhoneNumber } from '@/lib/utils';
import { buildCustomerPhoneData, buildCustomerPhoneMatchClauses } from '@/lib/phone';
import { blockedContentError, getBlockedFieldLabel } from '@/lib/moderation';
import { normalizeCustomerGroupIds } from '@/lib/customer-groups';
import { requireActiveSubscription, checkPlanLimit } from '@/lib/subscription';
import { revalidateTag } from 'next/cache';
import { getCustomerGroupsCacheTag } from '@/lib/cache-tags';
import {
  formatCustomerGroupRecord,
  formatMobileCustomerRecord,
} from '@/lib/mobile-customers';
import { startRecentTwilioKeywordSync } from '@/lib/twilio-keyword-sync';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 30;

async function getBusinessSummary(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      email: true,
      name: true,
      businessType: true,
      phone: true,
      street: true,
      city: true,
      state: true,
      zipCode: true,
      country: true,
    },
  });
}

export async function GET(request: Request) {
  const authorized = await requireMobileSession(request);
  if ('error' in authorized) {
    return authorized.error;
  }

  try {
    try {
      startRecentTwilioKeywordSync();
    } catch (error) {
      console.error('[twilio-keyword-sync] Failed to start background keyword sync:', error);
    }

    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get('search')?.trim() ?? '';
    const group = searchParams.get('group')?.trim() ?? '';
    const sms = searchParams.get('sms')?.trim() ?? '';
    const contact = searchParams.get('contact')?.trim() ?? '';
    const visit = searchParams.get('visit')?.trim() ?? '';
    const requestedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
    const requestedPageSize = Number.parseInt(
      searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE),
      10,
    );
    const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const pageSize =
      Number.isFinite(requestedPageSize) && requestedPageSize > 0
        ? Math.min(requestedPageSize, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;

    const where = buildCustomerWhereClause({
      businessId: authorized.session.businessId,
      search: search || undefined,
      group: group || undefined,
      sms: sms || undefined,
      contact: contact || undefined,
      visit: visit || undefined,
    });

    const [business, totalCustomers, groups] = await Promise.all([
      getBusinessSummary(authorized.session.businessId),
      prisma.customer.count({ where }),
      prisma.customerGroup.findMany({
        where: { businessId: authorized.session.businessId },
        include: {
          _count: {
            select: {
              memberships: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const totalPages = Math.max(1, Math.ceil(totalCustomers / pageSize));
    const normalizedPage = Math.min(currentPage, totalPages);

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: {
            checkIns: true,
            appointments: true,
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
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (normalizedPage - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      search,
      filters: {
        group,
        sms,
        contact,
        visit,
      },
      currentPage: normalizedPage,
      totalPages,
      totalCustomers,
      pageSize,
      groups: groups.map(formatCustomerGroupRecord),
      customers: customers.map(formatMobileCustomerRecord),
    });
  } catch (error) {
    console.error('GET /api/mobile/customers error:', error);
    return NextResponse.json({ error: 'Unable to load mobile customers' }, { status: 500 });
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

    const limitCheck = await checkPlanLimit(authorized.session.businessId, 'customers');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Customer limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan.`,
          code: 'PLAN_LIMIT_REACHED',
        },
        { status: 403 },
      );
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
    const hasSmsPhone = Boolean(phoneData.phone);

    if (email || formattedPhone) {
      const existing = await prisma.customer.findFirst({
        where: {
          businessId: authorized.session.businessId,
          OR: [
            email ? { email } : {},
            ...(formattedPhone ? buildCustomerPhoneMatchClauses(formattedPhone) : []),
          ].filter((entry) => Object.keys(entry).length > 0),
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Customer with this email or phone already exists' },
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

    const customer = await prisma.customer.create({
      data: {
        businessId: authorized.session.businessId,
        name,
        email: email || null,
        phone: phoneData.phone,
        phoneLookupKey: phoneData.phoneLookupKey,
        smsConsent: hasSmsPhone,
        smsMarketingConsent: hasSmsPhone,
        smsMarketingConsentAt: hasSmsPhone ? new Date() : null,
        smsOptedOut: false,
        smsOptedOutAt: null,
        birthday: birthday ? new Date(birthday) : null,
        notes: notes || null,
        dealSmsBlocked,
        segment: 'NEW',
        totalSpent: 0,
        ...(groupIds.length > 0
          ? {
              groupMemberships: {
                create: groupIds.map((groupId) => ({ groupId })),
              },
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            checkIns: true,
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
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    revalidateTag(`dashboard-stats-${authorized.session.businessId}`, 'max');
    revalidateTag(getCustomerGroupsCacheTag(authorized.session.businessId), 'max');

    return NextResponse.json(
      {
        customer: formatMobileCustomerRecord({
          ...customer,
          lastVisit: customer.lastVisit ?? null,
          dealSmsBlocked: customer.dealSmsBlocked,
          totalSpent: customer.totalSpent,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/mobile/customers error:', error);
    return NextResponse.json({ error: 'Unable to create customer' }, { status: 500 });
  }
}
