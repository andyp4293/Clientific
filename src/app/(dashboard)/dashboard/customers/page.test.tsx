import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    customerGroup: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('@/lib/twilio-keyword-sync', () => ({
  startRecentTwilioKeywordSync: vi.fn(),
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

const { mockCustomerList } = vi.hoisted(() => ({
  mockCustomerList: vi.fn(() => null),
}));

vi.mock('@/components/customers/CustomerList', () => ({
  default: (props: any) => {
    mockCustomerList(props);
    return React.createElement('div', { 'data-testid': 'customer-list-props' });
  },
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { startRecentTwilioKeywordSync } from '@/lib/twilio-keyword-sync';
import CustomersPage from './page';

const mockGetServerSession = getServerSession as unknown as ReturnType<typeof vi.fn>;
const mockCount = prisma.customer.count as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockGroupFindMany = prisma.customerGroup.findMany as ReturnType<typeof vi.fn>;
const mockStartRecentTwilioKeywordSync =
  startRecentTwilioKeywordSync as ReturnType<typeof vi.fn>;

describe('CustomersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartRecentTwilioKeywordSync.mockImplementation(() => undefined);
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);
    mockGroupFindMany.mockResolvedValue([]);
  });

  it('redirects to /login when no business session exists', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(
      CustomersPage({ searchParams: Promise.resolve({}) } as any),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('awaits async searchParams and applies the visible customer filters', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { businessId: 'biz-1' },
    });
    mockCount.mockResolvedValue(68);

    const page = await CustomersPage({
      searchParams: Promise.resolve({
        search: 'alice',
        sms: 'enabled',
        contact: 'both',
        visit: 'visited',
        page: '2',
        tab: 'groups',
      }),
    } as any);

    expect(mockStartRecentTwilioKeywordSync).toHaveBeenCalledTimes(1);
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-1',
        AND: [
          {
            OR: [
              { name: { contains: 'alice', mode: 'insensitive' } },
              { email: { contains: 'alice', mode: 'insensitive' } },
              { phone: { contains: 'alice', mode: 'insensitive' } },
            ],
          },
          {
            phone: { not: null },
            smsConsent: true,
            smsOptedOut: false,
          },
          {
            email: { not: null },
            phone: { not: null },
          },
          {
            lastVisit: { not: null },
          },
        ],
      },
    });
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-1',
        AND: [
          {
            OR: [
              { name: { contains: 'alice', mode: 'insensitive' } },
              { email: { contains: 'alice', mode: 'insensitive' } },
              { phone: { contains: 'alice', mode: 'insensitive' } },
            ],
          },
          {
            phone: { not: null },
            smsConsent: true,
            smsOptedOut: false,
          },
          {
            email: { not: null },
            phone: { not: null },
          },
          {
            lastVisit: { not: null },
          },
        ],
      },
      include: {
        _count: { select: { checkIns: true, appointments: true } },
        groupMemberships: expect.any(Object),
      },
      orderBy: { createdAt: 'desc' },
      skip: 25,
      take: 25,
    });
    expect(mockGroupFindMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      include: {
        _count: {
          select: {
            memberships: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });
    const customerListElement = (page as any).props.children[1];
    expect(customerListElement.props).toMatchObject({
      initialTab: 'groups',
      currentPage: 2,
      pageSize: 25,
      totalCustomers: 68,
      totalPages: 3,
    });
  });

  it('still renders when the background sync starter throws', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { businessId: 'biz-1' },
    });
    mockStartRecentTwilioKeywordSync.mockImplementation(() => {
      throw new Error('twilio slow');
    });

    const page = await CustomersPage({
      searchParams: Promise.resolve({}),
    } as any);

    const customerListElement = (page as any).props.children[1];
    expect(customerListElement.props).toMatchObject({
      initialTab: 'customers',
      currentPage: 1,
      totalCustomers: 0,
      totalPages: 1,
    });
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });
});
