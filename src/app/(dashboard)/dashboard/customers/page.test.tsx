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
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('@/components/customers/CustomerList', () => ({
  default: () => null,
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import CustomersPage from './page';

const mockGetServerSession = getServerSession as unknown as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.customer.findMany as ReturnType<typeof vi.fn>;
const mockGroupBy = prisma.customer.groupBy as ReturnType<typeof vi.fn>;

describe('CustomersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockGroupBy.mockResolvedValue([]);
  });

  it('redirects to /login when no business session exists', async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(
      CustomersPage({ searchParams: Promise.resolve({}) } as any),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });

  it('awaits async searchParams and applies the full customer filter set', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { businessId: 'biz-1' },
    });

    await CustomersPage({
      searchParams: Promise.resolve({
        search: 'alice',
        segment: 'VIP',
        sms: 'enabled',
        contact: 'both',
        visit: 'visited',
      }),
    } as any);

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
          { segment: 'VIP' },
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
      include: { _count: { select: { checkIns: true, appointments: true } } },
      orderBy: { createdAt: 'desc' },
    });

    expect(mockGroupBy).toHaveBeenCalledWith({
      by: ['segment'],
      where: { businessId: 'biz-1' },
      _count: true,
    });
  });
});
