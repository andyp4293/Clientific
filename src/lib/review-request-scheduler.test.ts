import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const createMessage = vi.fn();
  const listServices = vi.fn();
  const createService = vi.fn();
  const listAttachedPhoneNumbers = vi.fn();
  const attachPhoneNumber = vi.fn();
  const listIncomingPhoneNumbers = vi.fn();
  const serviceContext = vi.fn((sid: string) => ({
    phoneNumbers: {
      list: listAttachedPhoneNumbers,
      create: attachPhoneNumber,
    },
  }));
  const twilioFactory = vi.fn(() => ({
    messages: {
      create: createMessage,
    },
    messaging: {
      v1: {
        services: Object.assign(serviceContext, {
          list: listServices,
          create: createService,
        }),
      },
    },
    incomingPhoneNumbers: {
      list: listIncomingPhoneNumbers,
    },
  }));

  return {
    createMessage,
    listServices,
    createService,
    listAttachedPhoneNumbers,
    attachPhoneNumber,
    listIncomingPhoneNumbers,
    serviceContext,
    twilioFactory,
  };
});

vi.mock('twilio', () => ({
  default: hoisted.twilioFactory,
}));

import {
  resetReviewRequestSchedulingCacheForTests,
  scheduleReviewRequest,
} from './review-request-scheduler';

const ORIGINAL_ENV = { ...process.env };

describe('scheduleReviewRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetReviewRequestSchedulingCacheForTests();
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_PHONE_NUMBER = '+18557654989';
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;

    hoisted.createMessage.mockResolvedValue({ sid: 'SM123' });
    hoisted.listServices.mockResolvedValue([]);
    hoisted.createService.mockResolvedValue({ sid: 'MG_created', friendlyName: 'Clientific Scheduled SMS' });
    hoisted.listIncomingPhoneNumbers.mockResolvedValue([{ sid: 'PN_platform' }]);
    hoisted.listAttachedPhoneNumbers.mockResolvedValue([]);
    hoisted.attachPhoneNumber.mockResolvedValue({ sid: 'PN_attach' });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('uses a configured messaging service sid when available', async () => {
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG_configured';

    const sendAt = new Date('2026-03-28T18:00:00.000Z');
    const result = await scheduleReviewRequest(
      '+19087272437',
      {
        businessName: 'Davi Nails',
        customerName: 'Andy',
        surveyUrl: 'https://clientific.app/feedback/CF-8QXLBD?token=abc123',
      },
      sendAt
    );

    expect(result.success).toBe(true);
    expect(hoisted.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messagingServiceSid: 'MG_configured',
        scheduleType: 'fixed',
        sendAt,
        to: '+19087272437',
      })
    );
    expect(hoisted.listServices).not.toHaveBeenCalled();
  });

  it('creates and attaches a messaging service when one is not configured', async () => {
    const sendAt = new Date('2026-03-28T18:00:00.000Z');
    const result = await scheduleReviewRequest(
      '9087272437',
      {
        businessName: 'Davi Nails',
        customerName: 'Andy',
        surveyUrl: 'https://clientific.app/feedback/CF-8QXLBD?token=abc123',
      },
      sendAt
    );

    expect(result.success).toBe(true);
    expect(hoisted.createService).toHaveBeenCalledWith({
      friendlyName: 'Clientific Scheduled SMS',
    });
    expect(hoisted.listIncomingPhoneNumbers).toHaveBeenCalledWith({
      phoneNumber: '+18557654989',
      limit: 1,
    });
    expect(hoisted.attachPhoneNumber).toHaveBeenCalledWith({
      phoneNumberSid: 'PN_platform',
    });
    expect(hoisted.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        messagingServiceSid: 'MG_created',
        scheduleType: 'fixed',
        sendAt,
        to: '+19087272437',
      })
    );
  });
});
