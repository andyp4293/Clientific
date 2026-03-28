import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://clientific.app'),
}));

import { prisma } from '@/lib/prisma';
import { getConfiguredAppBaseUrl } from '@/lib/app-url';
import { createAppointmentBatchToken } from '@/lib/appointment-confirmation-batches';
import { GET } from '@/app/a/[shortId]/route';

describe('GET /a/[shortId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfiguredAppBaseUrl).mockReturnValue('https://clientific.app');
  });

  it('redirects to home when short id is not found', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null as any);

    const res = await GET(new NextRequest('http://localhost/a/ABC123'), {
      params: Promise.resolve({ shortId: 'ABC123' }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://clientific.app/');
    expect(prisma.appointment.findUnique).toHaveBeenCalledWith({
      where: { shortId: 'ABC123' },
      select: { id: true },
    });
  });

  it('redirects to appointment details when short id exists', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({ id: 'appt_123' } as any);

    const res = await GET(new NextRequest('http://localhost/a/XYZ999'), {
      params: Promise.resolve({ shortId: 'XYZ999' }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://clientific.app/appt/appt_123');
  });

  it('uses configured app base URL for redirects', async () => {
    vi.mocked(getConfiguredAppBaseUrl).mockReturnValue('https://staging.clientific.app');
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as any);

    const res = await GET(new NextRequest('http://localhost/a/XYZ000'), {
      params: Promise.resolve({ shortId: 'XYZ000' }),
    });

    expect(res.headers.get('location')).toBe('https://staging.clientific.app/');
  });

  it('redirects grouped AI confirmation links to the batch page when multiple appointments match', async () => {
    const token = createAppointmentBatchToken({
      b: 'biz-1',
      p: '5551234567',
      s: 1_775_000_000_000,
      e: 1_775_000_060_000,
    });

    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      { id: 'appt-1' },
      { id: 'appt-2' },
    ] as any);

    const res = await GET(new NextRequest(`http://localhost/a/${token}`), {
      params: Promise.resolve({ shortId: token }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`https://clientific.app/appt/batch/${encodeURIComponent(token)}`);
  });

  it('redirects grouped AI confirmation links to the single appointment page when only one appointment matches', async () => {
    const token = createAppointmentBatchToken({
      b: 'biz-1',
      p: '5551234567',
      s: 1_775_000_000_000,
      e: 1_775_000_060_000,
    });

    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([{ id: 'appt-1' }] as any);

    const res = await GET(new NextRequest(`http://localhost/a/${token}`), {
      params: Promise.resolve({ shortId: token }),
    });

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://clientific.app/appt/appt-1');
  });
});
