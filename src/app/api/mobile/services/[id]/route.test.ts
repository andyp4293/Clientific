import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/mobile-route', () => ({
  requireMobileSession: vi.fn(),
}));
vi.mock('@/lib/subscription', () => ({
  requireActiveSubscription: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    service: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    serviceGroup: {
      findFirst: vi.fn(),
    },
    appointment: {
      count: vi.fn(),
    },
  },
}));

import { requireMobileSession } from '@/lib/mobile-route';
import { prisma } from '@/lib/prisma';
import { DELETE, PATCH } from './route';

const mockRequireMobileSession = requireMobileSession as ReturnType<typeof vi.fn>;
const mockFindService = prisma.service.findFirst as ReturnType<typeof vi.fn>;
const mockUpdateService = prisma.service.update as ReturnType<typeof vi.fn>;
const mockDeleteService = prisma.service.delete as ReturnType<typeof vi.fn>;
const mockFindGroup = prisma.serviceGroup.findFirst as ReturnType<typeof vi.fn>;
const mockCountAppointments = prisma.appointment.count as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMobileSession.mockResolvedValue({ session: { businessId: 'biz-1' } });
});

describe('PATCH /api/mobile/services/[id]', () => {
  it('updates a service and returns the formatted record', async () => {
    mockFindService.mockResolvedValue({ id: 'svc-1' });
    mockFindGroup.mockResolvedValue({ id: 'group-1', name: 'Hair' });
    mockUpdateService.mockResolvedValue({
      id: 'svc-1',
      name: 'Haircut Deluxe',
      description: 'Longer appointment',
      duration: 90,
      price: 80,
      active: false,
      groupId: 'group-1',
      sortOrder: 0,
    });

    const response = await PATCH(
      new Request('https://www.clientific.app/api/mobile/services/svc-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Haircut Deluxe',
          duration: 90,
          price: 80,
          isActive: false,
          groupId: 'group-1',
        }),
      }),
      { params: Promise.resolve({ id: 'svc-1' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.service).toMatchObject({
      id: 'svc-1',
      name: 'Haircut Deluxe',
      groupName: 'Hair',
      isActive: false,
      durationLabel: '1 hr 30 min',
    });
  });
});

describe('DELETE /api/mobile/services/[id]', () => {
  it('deletes a service without appointments', async () => {
    mockFindService.mockResolvedValue({ id: 'svc-1' });
    mockCountAppointments.mockResolvedValue(0);
    mockDeleteService.mockResolvedValue({ id: 'svc-1' });

    const response = await DELETE(
      new Request('https://www.clientific.app/api/mobile/services/svc-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'svc-1' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockDeleteService).toHaveBeenCalledWith({ where: { id: 'svc-1' } });
  });
});
