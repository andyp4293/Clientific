import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBearerToken, verifyMobileSessionToken } from '@/lib/mobile-session';
import { isBusinessOnboardingComplete } from '@/lib/onboarding';
import { buildCustomerWhereClause } from '@/lib/customer-filters';
import { formatPhoneForDisplay } from '@/lib/phone';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 30;

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return 'Never';
  }

  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount ?? 0);
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let session: Awaited<ReturnType<typeof verifyMobileSessionToken>>;
    try {
      session = await verifyMobileSessionToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: session.businessId },
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

    if (!business) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = new URL(request.url).searchParams;
    const search = searchParams.get('search')?.trim() ?? '';
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
      businessId: business.id,
      search: search || undefined,
    });

    const [totalCustomers, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
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
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCustomers / pageSize));
    const normalizedPage = Math.min(currentPage, totalPages);

    return NextResponse.json({
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        businessType: business.businessType,
        onboardingComplete: isBusinessOnboardingComplete(business),
      },
      search,
      currentPage: normalizedPage,
      totalPages,
      totalCustomers,
      pageSize,
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phoneDisplay: formatPhoneForDisplay(customer.phone),
        joinedLabel: formatDateLabel(customer.createdAt),
        lastVisitLabel: formatDateLabel(customer.lastVisit),
        totalSpentLabel: formatCurrency(customer.totalSpent),
        smsConsent: customer.smsConsent,
        smsOptedOut: customer.smsOptedOut,
        dealSmsBlocked: customer.dealSmsBlocked === true,
        visitsCount: customer._count.checkIns,
        groups: customer.groupMemberships.map(({ group }) => ({
          id: group.id,
          name: group.name,
          promotionSmsEnabled: group.promotionSmsEnabled,
        })),
      })),
    });
  } catch (error) {
    console.error('GET /api/mobile/customers error:', error);
    return NextResponse.json({ error: 'Unable to load mobile customers' }, { status: 500 });
  }
}
