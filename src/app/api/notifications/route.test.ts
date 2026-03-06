import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: { findMany: vi.fn() },
  },
}));

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { GET } from './route';

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockNotificationFindMany = prisma.notification.findMany as ReturnType<typeof vi.fn>;

// Notifications use session.user.id as businessId
const activeSession = { user: { id: 'biz-1' } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/notifications', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns notifications and unreadCount', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockNotificationFindMany.mockResolvedValue([
      { id: 'n-1', read: false, createdAt: new Date() },
      { id: 'n-2', read: true, createdAt: new Date() },
      { id: 'n-3', read: false, createdAt: new Date() },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(3);
    expect(body.unreadCount).toBe(2);
  });

  it('returns empty list when no notifications', async () => {
    mockSession.mockResolvedValue(activeSession);
    mockNotificationFindMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toHaveLength(0);
    expect(body.unreadCount).toBe(0);
  });
});
