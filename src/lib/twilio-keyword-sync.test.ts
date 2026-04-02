import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockMessagesList,
  mockCustomerFindMany,
  mockCustomerUpdateMany,
  mockConsentFindMany,
  mockConsentCreateMany,
  mockConsentCreate,
} = vi.hoisted(() => ({
  mockMessagesList: vi.fn(),
  mockCustomerFindMany: vi.fn(),
  mockCustomerUpdateMany: vi.fn(),
  mockConsentFindMany: vi.fn(),
  mockConsentCreateMany: vi.fn(),
  mockConsentCreate: vi.fn(),
}));

vi.mock('twilio', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    messages: {
      list: mockMessagesList,
    },
  })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findMany: mockCustomerFindMany,
      updateMany: mockCustomerUpdateMany,
    },
    smsConsentEvent: {
      findMany: mockConsentFindMany,
      createMany: mockConsentCreateMany,
      create: mockConsentCreate,
    },
  },
}));

import { syncRecentTwilioKeywordMessages } from '@/lib/twilio-keyword-sync';

describe('syncRecentTwilioKeywordMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'auth_test';
    process.env.TWILIO_PHONE_NUMBER = '+18557654989';
    mockConsentFindMany.mockResolvedValue([]);
    mockConsentCreateMany.mockResolvedValue({ count: 0 });
    mockConsentCreate.mockResolvedValue({});
    mockCustomerUpdateMany.mockResolvedValue({ count: 0 });
  });

  it('reconciles a missed START keyword into opted-in customer rows', async () => {
    mockMessagesList.mockResolvedValue([
      {
        sid: 'SM_start_1',
        body: 'START',
        from: '+19087272437',
        to: '+18557654989',
        dateCreated: new Date('2026-04-02T23:16:59.000Z'),
      },
    ]);
    mockCustomerFindMany.mockResolvedValue([
      { id: 'cust-1', businessId: 'biz-1', phone: '9087272437' },
      { id: 'cust-2', businessId: 'biz-2', phone: '9087272437' },
    ]);

    await syncRecentTwilioKeywordMessages({ force: true });

    expect(mockMessagesList).toHaveBeenCalledWith({
      to: '+18557654989',
      limit: 25,
    });
    expect(mockCustomerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: {
            in: ['cust-1', 'cust-2'],
          },
        },
        data: expect.objectContaining({
          smsOptedOut: false,
          smsConsent: true,
          smsMarketingConsent: true,
          optedInMarketing: true,
          optedOutAt: null,
        }),
      })
    );
    expect(mockConsentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            customerId: 'cust-1',
            eventType: 'START',
            messageSid: 'SM_start_1',
          }),
        ]),
      })
    );
  });

  it('reconciles a missed STOP keyword into opted-out customer rows', async () => {
    mockMessagesList.mockResolvedValue([
      {
        sid: 'SM_stop_1',
        body: 'STOP',
        from: '+19087272437',
        to: '+18557654989',
        dateCreated: new Date('2026-04-02T23:08:21.000Z'),
      },
    ]);
    mockCustomerFindMany.mockResolvedValue([
      { id: 'cust-1', businessId: 'biz-1', phone: '9087272437' },
    ]);

    await syncRecentTwilioKeywordMessages({ force: true });

    expect(mockCustomerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsOptedOut: true,
          smsConsent: false,
          smsMarketingConsent: false,
          optedInMarketing: false,
        }),
      })
    );
    expect(mockConsentCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            customerId: 'cust-1',
            eventType: 'STOP',
            messageSid: 'SM_stop_1',
          }),
        ]),
      })
    );
  });

  it('skips keyword messages that are already recorded', async () => {
    mockMessagesList.mockResolvedValue([
      {
        sid: 'SM_existing',
        body: 'START',
        from: '+19087272437',
        to: '+18557654989',
        dateCreated: new Date('2026-04-02T23:16:59.000Z'),
      },
    ]);
    mockConsentFindMany.mockResolvedValue([{ messageSid: 'SM_existing' }]);

    await syncRecentTwilioKeywordMessages({ force: true });

    expect(mockCustomerFindMany).not.toHaveBeenCalled();
    expect(mockCustomerUpdateMany).not.toHaveBeenCalled();
    expect(mockConsentCreateMany).not.toHaveBeenCalled();
    expect(mockConsentCreate).not.toHaveBeenCalled();
  });
});
