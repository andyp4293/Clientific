import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/public-available-slots', () => ({
  getPublicAvailableSlots: vi.fn(),
  PublicAvailableSlotsError: class PublicAvailableSlotsError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { getPublicAvailableSlots } from '@/lib/public-available-slots';
import { GET } from './route';

describe('GET /api/public/business/[slug]/available-slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates slug lookups to the shared available-slots helper', async () => {
    vi.mocked(getPublicAvailableSlots).mockResolvedValue({
      slots: [],
      unavailableSlots: [],
      availabilityReason: 'staff_off_day',
      message: 'Selected staff member is off on this day.',
    });

    const req = new NextRequest(
      'http://localhost/api/public/business/test-salon/available-slots?date=2026-03-15&serviceId=svc-1&staffId=stf-1&duration=90'
    );
    const res = await GET(req, { params: Promise.resolve({ slug: 'test-salon' }) });

    expect(getPublicAvailableSlots).toHaveBeenCalledWith({
      businessLookup: { slug: 'test-salon' },
      date: '2026-03-15',
      serviceId: 'svc-1',
      staffId: 'stf-1',
      durationOverride: '90',
    });
    await expect(res.json()).resolves.toMatchObject({
      availabilityReason: 'staff_off_day',
    });
  });
});
