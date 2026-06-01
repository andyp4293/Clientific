import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockSendDueTrialEndingReminders } = vi.hoisted(() => ({
  mockSendDueTrialEndingReminders: vi.fn(),
}));

vi.mock('@/lib/trial-reminders', () => ({
  sendDueTrialEndingReminders: mockSendDueTrialEndingReminders,
}));

import { GET } from './route';

describe('GET /api/cron/trial-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    mockSendDueTrialEndingReminders.mockResolvedValue({
      checkedCount: 2,
      sentCount: 1,
      skippedCount: 1,
      failedCount: 0,
    });
  });

  it('requires the cron bearer token', async () => {
    const req = new NextRequest('http://localhost/api/cron/trial-reminders');
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockSendDueTrialEndingReminders).not.toHaveBeenCalled();
  });

  it('returns 503 if CRON_SECRET is missing so reminders do not run unsecured', async () => {
    delete process.env.CRON_SECRET;

    const req = new NextRequest('http://localhost/api/cron/trial-reminders', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    });
    const res = await GET(req);

    expect(res.status).toBe(503);
    expect(mockSendDueTrialEndingReminders).not.toHaveBeenCalled();
  });

  it('runs trial reminders and reports the delivery summary', async () => {
    const req = new NextRequest('http://localhost/api/cron/trial-reminders', {
      headers: {
        authorization: 'Bearer cron-secret',
      },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checkedCount).toBe(2);
    expect(body.sentCount).toBe(1);
    expect(mockSendDueTrialEndingReminders).toHaveBeenCalledWith({
      now: expect.any(Date),
    });
  });
});
