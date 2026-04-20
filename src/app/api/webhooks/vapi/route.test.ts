import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findFirst: vi.fn() },
    service: { findMany: vi.fn() },
    staff: { findFirst: vi.fn() },
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    customer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    notification: { create: vi.fn() },
    aiCallSession: { upsert: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/twilio', () => ({
  normalizeOptionalPhoneNumber: vi.fn((value: string | null) => value),
  sendAppointmentBatchConfirmation: vi.fn().mockResolvedValue({ success: true }),
  sendAppointmentConfirmation: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/appointment-reminders', () => ({
  cancelScheduledAppointmentReminder: vi.fn().mockResolvedValue({ success: true, canceledCount: 1 }),
}));

vi.mock('@/lib/app-url', () => ({
  getConfiguredAppBaseUrl: vi.fn(() => 'https://clientific.app'),
  getConfiguredWebhookBaseUrl: vi.fn(() => 'https://www.clientific.app'),
}));

import { prisma } from '@/lib/prisma';
import { sendAppointmentBatchConfirmation, sendAppointmentConfirmation } from '@/lib/twilio';
import { cancelScheduledAppointmentReminder } from '@/lib/appointment-reminders';
import { POST } from './route';

function req(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/webhooks/vapi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE_BUSINESS = {
  id: 'biz-1',
  name: 'Test Salon',
  businessType: 'Salon',
  phone: '+15551230000',
  vapiPhoneNumber: '+15557654321',
  publicId: 'AB-123456',
  street: '123 Main St',
  city: 'Howell',
  state: 'NJ',
  timezone: 'America/New_York',
  aiReceptionistGreeting: null,
  aiReceptionistSpanishEnabled: false,
  aiReceptionistPhone: null,
  aiReceptionistFaq: [],
  services: [
    { id: 'svc-gel', name: 'Gel Manicure', price: 45, duration: 45 },
    { id: 'svc-pedi', name: 'Pedicure', price: 55, duration: 60 },
  ],
  staff: [
    {
      id: 'staff-1',
      fullName: 'Andy',
      role: 'Technician',
      workDays: [0, 1, 3, 4, 5, 6],
      workHours: {
        1: { startTime: '10:00', endTime: '16:00' },
        3: { startTime: '09:00', endTime: '15:00' },
      },
    },
  ],
  businessHours: {
    hours: {
      '0': { isOpen: false, openTime: null, closeTime: null },
      '1': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      '2': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      '3': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      '4': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      '5': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
      '6': { isOpen: true, openTime: '09:00', closeTime: '17:00' },
    },
  },
  closureDates: [],
} as const;

describe('POST /api/webhooks/vapi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    vi.mocked(prisma.business.findFirst).mockResolvedValue(BASE_BUSINESS as any);
    vi.mocked(prisma.service.findMany).mockImplementation(async (args: any) => {
      const allServices = [
        { id: 'svc-gel', name: 'Gel Manicure', duration: 45 },
        { id: 'svc-pedi', name: 'Pedicure', duration: 60 },
      ];
      const requestedIds = args?.where?.id?.in;
      if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
        return allServices as any;
      }

      return allServices.filter((service) => requestedIds.includes(service.id)) as any;
    });
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [2],
      workHours: {
        2: { startTime: '09:00', endTime: '17:00' },
      },
      serviceAssignments: [
        { serviceId: 'svc-gel' },
        { serviceId: 'svc-pedi' },
      ],
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appointment.count).mockResolvedValue(0);
    vi.mocked(prisma.appointment.create).mockResolvedValue({ id: 'appt-1' } as any);
    vi.mocked(prisma.appointment.update).mockResolvedValue({ id: 'appt-1' } as any);
    vi.mocked(prisma.appointment.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([]);
    vi.mocked(prisma.customer.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.customer.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.customer.create).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      phoneLookupKey: '5551234567',
      smsConsent: true,
      smsOptedOut: false,
    } as any);
    vi.mocked(prisma.customer.update).mockResolvedValue({
      id: 'cust-1',
      name: 'Jane',
      phone: '+15551234567',
      phoneLookupKey: '5551234567',
      smsConsent: true,
      smsOptedOut: false,
    } as any);
    vi.mocked(prisma.customer.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notif-1' } as any);
    vi.mocked(prisma.aiCallSession.upsert).mockResolvedValue({ id: 'call-session-1' } as any);
    vi.mocked(prisma.aiCallSession.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.aiCallSession.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) =>
      fn({
        appointment: {
          count: prisma.appointment.count,
          create: prisma.appointment.create,
          update: prisma.appointment.update,
        },
      })
    );
  });

  it('teaches the assistant to keep multiple services in one booking', async () => {
    const res = await POST(
      req({
        message: {
          type: 'assistant-request',
          phoneNumber: { id: 'phone-1' },
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    const toolProps = body.assistant.model.tools[0].function.parameters.properties;
    const systemPrompt = body.assistant.model.messages[0].content as string;

    expect(body.assistant.model.provider).toBe('openai');
    expect(body.assistant.model.model).toBe('gpt-4.1-mini');
    expect(body.assistant.model.fallbackModels).toEqual(['gpt-4.1', 'gpt-4.1-nano']);
    expect(toolProps.serviceIds).toBeDefined();
    expect(systemPrompt).toContain('Do NOT split them into separate bookings');
    expect(systemPrompt).toContain('serviceIds for every requested service');
    expect(systemPrompt).toContain('maximum is 5 services in one appointment');
    expect(systemPrompt).toContain('keep that same staffId on every later manage_booking call');
    expect(systemPrompt).toContain('Tue off');
    expect(systemPrompt).toContain('Mon 10:00 AM-4:00 PM');
    expect(systemPrompt).toContain('could not find them on the team');
  });

  it('keeps spanish-enabled calls on the main assistant flow with keypad-aware language instructions', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      ...BASE_BUSINESS,
      aiReceptionistSpanishEnabled: true,
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'assistant-request',
          phoneNumber: { id: 'phone-1' },
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    const systemPrompt = body.assistant.model.messages[0].content as string;

    expect(body.workflow).toBeUndefined();
    expect(body.assistant).toBeDefined();
    expect(body.assistant.server).toMatchObject({
      url: 'https://www.clientific.app/api/webhooks/vapi',
    });
    expect(body.assistant.firstMessage).toContain('Hi, this is Test Salon.');
    expect(body.assistant.firstMessage).toContain('For English, press 1.');
    expect(body.assistant.firstMessage).toContain('Or say English.');
    expect(body.assistant.firstMessage).toContain('Hola, habla Test Salon.');
    expect(body.assistant.firstMessage).toContain('Para espanol, oprima 2.');
    expect(body.assistant.firstMessage).toContain('O diga espanol.');
    expect(body.assistant.transcriber).toMatchObject({
      provider: 'deepgram',
      model: 'nova-2',
      language: 'multi',
    });
    expect(body.assistant.model).toMatchObject({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      fallbackModels: ['gpt-4.1', 'gpt-4.1-nano'],
    });
    expect(systemPrompt).toContain('You are fully bilingual in English and Spanish.');
    expect(systemPrompt).toContain(
      'Vapi may surface keypad selections in the transcript as phrases like "Press User\'s Keypad Entry: 1"'
    );
    expect(systemPrompt).toContain(
      'Treat 1 as English and 2 as Spanish immediately.'
    );
    expect(systemPrompt).toContain(
      'If the caller only chooses a language and has not asked their actual question yet, continue naturally with "How can I help you today?" in English or "Como puedo ayudarle hoy?" in Spanish.'
    );
    expect(systemPrompt).toContain(
      "Never ask for the caller's phone number or callback number at the beginning of the call."
    );
    expect(systemPrompt).toContain(
      "If the caller's requested service is unclear, sounds misheard, or does not clearly match one of the listed services"
    );
    expect(systemPrompt).toContain(
      'If a booking or appointment request is still in progress, you are not done. Ask a short follow-up or clarification question instead of ending the call.'
    );
    expect(systemPrompt).toContain(
      'Questions about whether the business is for sale'
    );
    expect(body.assistant.model.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function',
          function: expect.objectContaining({
            name: 'manage_booking',
          }),
        }),
        expect.objectContaining({ type: 'endCall' }),
      ]),
    );
  });

  it('includes specific closure dates in the assistant prompt', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      ...BASE_BUSINESS,
      closureDates: [{ date: '2026-12-25', label: 'Christmas Day' }],
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'assistant-request',
          phoneNumber: { id: 'phone-1' },
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    const systemPrompt = body.assistant.model.messages[0].content as string;

    expect(systemPrompt).toContain('Specific closed dates');
    expect(systemPrompt).toContain('closed for Christmas Day');
  });

  it('includes the saved transfer phone and Vapi transfer tool in the assistant config', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      ...BASE_BUSINESS,
      aiReceptionistPhone: '9087272437',
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'assistant-request',
          phoneNumber: { id: 'phone-1' },
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    const systemPrompt = body.assistant.model.messages[0].content as string;
    const transferTool = body.assistant.model.tools.find(
      (tool: any) => tool?.type === 'transferCall'
    );

    expect(systemPrompt).toContain('say exactly: "Let me connect you now."');
    expect(systemPrompt).toContain('Then immediately call transferCall');
    expect(systemPrompt).toContain('ask whether they would like to be transferred to someone who might be able to help');
    expect(systemPrompt).toContain('do not guess');
    expect(systemPrompt).toContain('Only answer a factual business question when the answer is explicitly supported by the information above');
    expect(systemPrompt).toContain('Questions about whether the business is for sale');
    expect(systemPrompt).toContain('whether someone can buy the business');
    expect(transferTool).toEqual({
      type: 'transferCall',
      destinations: [
        {
          type: 'number',
          number: '9087272437',
          message: 'I am forwarding your call now. Please stay on the line.',
        },
      ],
    });
  });

  it('stores a requested staff preference from conversation updates', async () => {
    const res = await POST(
      req({
        message: {
          type: 'conversation-update',
          phoneNumber: { id: 'phone-1' },
          call: {
            id: 'call-1',
            customer: { number: '+15551234567' },
          },
          conversation: [
            { role: 'assistant', content: 'Hi, how can I help you?' },
            { role: 'user', content: 'Can I book a gel manicure with Andy on Tuesday at 9 AM?' },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.aiCallSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { callId: 'call-1' },
        create: expect.objectContaining({
          businessId: 'biz-1',
          callId: 'call-1',
          callerPhone: '5551234567',
          requestedStaffId: 'staff-1',
          requestedStaffName: 'Andy',
        }),
      })
    );
  });

  it('refuses availability when the requested staff member is off that day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [1],
      workHours: {
        1: { startTime: '10:00', endTime: '16:00' },
      },
      serviceAssignments: [
        { serviceId: 'svc-gel' },
        { serviceId: 'svc-pedi' },
      ],
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'checkAvailability',
                  date: '2026-03-10',
                  serviceIds: ['svc-gel', 'svc-pedi'],
                  staffId: 'staff-1',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain("Andy doesn't work on that day");
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('refuses availability on a specific closed date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      ...BASE_BUSINESS,
      closureDates: [{ date: '2026-03-10', label: 'Training Day' }],
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'checkAvailability',
                  date: '2026-03-10',
                  serviceIds: ['svc-gel'],
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('Business is closed for Training Day.');
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('refuses to create a booking on a specific closed date', async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValue({
      ...BASE_BUSINESS,
      closureDates: [{ date: '2026-03-10', label: 'Training Day' }],
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2026-03-10T14:00:00.000Z',
                  customerName: 'Jane',
                  serviceIds: ['svc-gel'],
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('Business is closed for Training Day.');
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('does not offer times outside a staff member’s working hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    vi.mocked(prisma.service.findMany).mockResolvedValueOnce([
      { id: 'svc-gel', name: 'Gel Manicure', duration: 45 },
    ] as any);
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [1],
      workHours: {
        1: { startTime: '10:00', endTime: '16:00' },
      },
      serviceAssignments: [
        { serviceId: 'svc-gel' },
        { serviceId: 'svc-pedi' },
      ],
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'checkAvailability',
                  date: '2026-03-09',
                  requestedTime: '9 AM',
                  serviceIds: ['svc-gel'],
                  staffId: 'staff-1',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain("9:00 AM isn't available");
    expect(body.results[0].result).toContain('10:00 AM');
  });

  it('confirms the saved caller name when the phone number matches exactly one customer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    vi.mocked(prisma.service.findMany).mockResolvedValueOnce([
      { id: 'svc-gel', name: 'Gel Manicure', duration: 45 },
    ] as any);
    vi.mocked(prisma.customer.findMany)
      .mockResolvedValueOnce([
        {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: '+15551234567',
          phoneLookupKey: '5551234567',
        },
      ] as any)
      .mockResolvedValueOnce([] as any);
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [1],
      workHours: {
        1: { startTime: '10:00', endTime: '16:00' },
      },
      serviceAssignments: [{ serviceId: 'svc-gel' }],
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'checkAvailability',
                  date: '2026-03-09',
                  requestedTime: '10 AM',
                  serviceIds: ['svc-gel'],
                  staffId: 'staff-1',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('I have your name as Andy. Is that right?');
  });

  it('keeps the requested staff member attached across tool calls when Vapi omits staffId', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [1],
      workHours: {
        1: { startTime: '10:00', endTime: '16:00' },
      },
      serviceAssignments: [
        { serviceId: 'svc-gel' },
        { serviceId: 'svc-pedi' },
      ],
    } as any);
    vi.mocked(prisma.aiCallSession.findUnique).mockResolvedValue({
      requestedStaffId: 'staff-1',
      requestedStaffName: 'Andy',
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { id: 'call-1', customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'checkAvailability',
                  date: '2026-03-10',
                  serviceIds: ['svc-gel', 'svc-pedi'],
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain("Andy doesn't work on that day");
    expect(prisma.aiCallSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { callId: 'call-1' },
      })
    );
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it('rejects unavailable exact times for a remembered staff member with existing appointments', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    vi.mocked(prisma.aiCallSession.findUnique).mockResolvedValue({
      requestedStaffId: 'staff-1',
      requestedStaffName: 'Andy',
    } as any);
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [2],
      workHours: {
        2: { startTime: '09:00', endTime: '17:00' },
      },
      serviceAssignments: [
        { serviceId: 'svc-gel' },
        { serviceId: 'svc-pedi' },
      ],
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        startTime: new Date('2026-03-10T14:00:00.000Z'),
        endTime: new Date('2026-03-10T15:45:00.000Z'),
      },
    ] as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { id: 'call-1', customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'checkAvailability',
                  date: '2026-03-10',
                  requestedTime: '10 AM',
                  serviceIds: ['svc-gel', 'svc-pedi'],
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain("10:00 AM isn't available");
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staffId: 'staff-1',
        }),
      })
    );
  });

  it('treats pending staff requests as blocking when creating a named-staff booking', async () => {
    vi.mocked(prisma.appointment.count).mockResolvedValueOnce(1);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { id: 'call-1', customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2099-03-10T15:00:00.000Z',
                  customerName: 'Jane',
                  serviceIds: ['svc-gel', 'svc-pedi'],
                  staffId: 'staff-1',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('That time was just taken');
    expect(prisma.appointment.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staffId: 'staff-1',
          status: { in: ['pending', 'scheduled', 'confirmed'] },
        }),
      })
    );
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('does not run staff conflict checks when the booking is for anyone available', async () => {
    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { id: 'call-1', customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2099-03-10T15:00:00.000Z',
                  customerName: 'Jane',
                  serviceIds: ['svc-gel', 'svc-pedi'],
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('Booking confirmed!');
    expect(prisma.appointment.count).not.toHaveBeenCalled();
    expect(prisma.appointment.create).toHaveBeenCalledTimes(1);
    const createArg = vi.mocked(prisma.appointment.create).mock.calls[0]?.[0];
    expect(createArg).toBeDefined();
    expect(createArg?.data).not.toHaveProperty('staffId');
  });

  it('blocks booking when the caller asks for someone who is not on staff', async () => {
    vi.mocked(prisma.aiCallSession.findUnique).mockResolvedValue({
      requestedStaffId: null,
      requestedStaffName: 'Taylor',
    } as any);
    vi.mocked(prisma.service.findMany).mockResolvedValueOnce([
      { id: 'svc-gel', name: 'Gel Manicure', duration: 45 },
    ] as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { id: 'call-1', customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2026-03-10T15:00:00.000Z',
                  customerName: 'Jane',
                  serviceIds: ['svc-gel'],
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain("I couldn't find Taylor on the team");
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('uses the combined service duration when checking a requested staff member', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [2],
      workHours: {
        2: { startTime: '09:00', endTime: '17:00' },
      },
      serviceAssignments: [
        { serviceId: 'svc-gel' },
        { serviceId: 'svc-pedi' },
      ],
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        startTime: new Date('2026-03-10T16:00:00.000Z'),
        endTime: new Date('2026-03-10T16:30:00.000Z'),
      },
    ] as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'checkAvailability',
                  date: '2026-03-10',
                  requestedTime: '11 AM',
                  serviceIds: ['svc-gel', 'svc-pedi'],
                  staffId: 'staff-1',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain("11:00 AM isn't available");
  });

  it('creates one combined AI appointment for multiple requested services', async () => {
    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2026-03-10T15:00:00.000Z',
                  customerName: 'Jane',
                  serviceIds: ['svc-gel', 'svc-pedi'],
                  staffId: 'staff-1',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(prisma.appointment.create).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceId: 'svc-gel',
          serviceIds: ['svc-gel', 'svc-pedi'],
          duration: 105,
          source: 'ai',
          staffId: 'staff-1',
        }),
      })
    );
    expect(sendAppointmentConfirmation).toHaveBeenCalledWith(
      '5551234567',
      expect.objectContaining({
        serviceName: 'Gel Manicure and Pedicure',
        duration: 105,
      })
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { confirmationSent: true },
    });
    expect(body.results[0].result).toContain('Gel Manicure and Pedicure');
  });

  it('sends the immediate request SMS even when the live Vapi call includes a call id', async () => {
    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { id: 'call-123', customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2026-03-10T15:00:00.000Z',
                  customerName: 'Jane',
                  serviceIds: ['svc-gel'],
                },
              },
            },
          ],
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('Booking confirmed!');
    expect(prisma.appointment.create).toHaveBeenCalledTimes(1);
    expect(sendAppointmentConfirmation).toHaveBeenCalledWith(
      '5551234567',
      expect.objectContaining({
        serviceName: 'Gel Manicure',
      }),
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { confirmationSent: true },
    });
    expect(sendAppointmentBatchConfirmation).not.toHaveBeenCalled();
  });

  it('falls back to the grouped end-of-call text if the immediate AI booking SMS fails', async () => {
    vi.mocked(sendAppointmentConfirmation).mockResolvedValueOnce({
      success: false,
      error: 'carrier reject',
    } as any);

    const bookingRes = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { id: 'call-123', customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2026-03-10T15:00:00.000Z',
                  customerName: 'Jane',
                  serviceIds: ['svc-gel'],
                },
              },
            },
          ],
        },
      }),
    );

    expect(bookingRes.status).toBe(200);
    const bookingBody = await bookingRes.json();
    expect(bookingBody.results[0].result).toContain('Booking confirmed!');
    expect(prisma.appointment.create).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.update).not.toHaveBeenCalledWith({
      where: { id: 'appt-1' },
      data: { confirmationSent: true },
    });

    vi.mocked(prisma.aiCallSession.findUnique).mockResolvedValueOnce({
      createdAt: new Date('2026-03-10T14:45:00.000Z'),
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValueOnce([
      { id: 'appt-1', customer: { name: 'Jane' } },
    ] as any);

    const statusRes = await POST(
      req({
        message: {
          type: 'status-update',
          status: 'ended',
          phoneNumber: { id: 'phone-1' },
          call: {
            id: 'call-123',
            customer: { number: '+15551234567' },
          },
        },
      }),
    );

    expect(statusRes.status).toBe(200);
    expect(sendAppointmentBatchConfirmation).toHaveBeenCalledWith(
      '5551234567',
      expect.objectContaining({
        appointmentCount: 1,
      }),
    );
  });

  it('reuses the matched caller name when createBooking does not receive a new name', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValueOnce([
      { id: 'svc-gel', name: 'Gel Manicure', duration: 45 },
    ] as any);
    vi.mocked(prisma.customer.findMany)
      .mockResolvedValueOnce([
        {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: '+15551234567',
          phoneLookupKey: '5551234567',
        },
      ] as any)
      .mockResolvedValueOnce([{ id: 'cust-1' }] as any);
    vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce({
      id: 'cust-1',
      name: 'Andy Pham',
      phone: '+15551234567',
      phoneLookupKey: '5551234567',
    } as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2099-03-10T15:00:00.000Z',
                  serviceIds: ['svc-gel'],
                  staffId: 'staff-1',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('Andy Pham');
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1' },
        data: expect.objectContaining({ name: 'Andy Pham' }),
      })
    );
  });

  it('lists appointments with full weekday and month names', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ id: 'cust-1' }] as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'appt-1',
        startTime: new Date('2026-03-28T19:00:00.000Z'),
        status: 'scheduled',
        service: { name: 'Gel Manicure' },
        staff: { fullName: 'Andy' },
      },
    ] as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'getAppointments',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('Saturday, March 28, 2026');
    expect(body.results[0].result).toContain('Which one would you like to change or cancel?');
  });

  it('reschedules multiple same-staff appointments in place and keeps them back to back', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({
      id: 'staff-1',
      fullName: 'Andy',
      workDays: [1],
      workHours: {
        1: { startTime: '10:00', endTime: '16:00' },
      },
      serviceAssignments: [{ serviceId: 'svc-gel' }],
    } as any);
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ id: 'cust-1' }] as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'appt-1',
        businessId: 'biz-1',
        customerId: 'cust-1',
        serviceId: 'svc-gel',
        serviceIds: ['svc-gel'],
        staffId: 'staff-1',
        startTime: new Date('2026-03-28T14:00:00.000Z'),
        endTime: new Date('2026-03-28T14:45:00.000Z'),
        duration: 45,
        status: 'scheduled',
        notes: null,
        source: 'dashboard',
        shortId: 'AAA1111',
        customer: {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: '+15551234567',
          smsConsent: true,
          smsOptedOut: false,
        },
        service: { name: 'Gel Manicure' },
        staff: { fullName: 'Andy' },
      },
      {
        id: 'appt-2',
        businessId: 'biz-1',
        customerId: 'cust-1',
        serviceId: 'svc-gel',
        serviceIds: ['svc-gel'],
        staffId: 'staff-1',
        startTime: new Date('2026-03-28T15:00:00.000Z'),
        endTime: new Date('2026-03-28T15:45:00.000Z'),
        duration: 45,
        status: 'scheduled',
        notes: null,
        source: 'dashboard',
        shortId: 'BBB2222',
        customer: {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: '+15551234567',
          smsConsent: true,
          smsOptedOut: false,
        },
        service: { name: 'Gel Manicure' },
        staff: { fullName: 'Andy' },
      },
      {
        id: 'appt-3',
        businessId: 'biz-1',
        customerId: 'cust-1',
        serviceId: 'svc-gel',
        serviceIds: ['svc-gel'],
        staffId: 'staff-1',
        startTime: new Date('2026-03-28T16:00:00.000Z'),
        endTime: new Date('2026-03-28T16:45:00.000Z'),
        duration: 45,
        status: 'scheduled',
        notes: null,
        source: 'dashboard',
        shortId: 'CCC3333',
        customer: {
          id: 'cust-1',
          name: 'Andy Pham',
          phone: '+15551234567',
          smsConsent: true,
          smsOptedOut: false,
        },
        service: { name: 'Gel Manicure' },
        staff: { fullName: 'Andy' },
      },
    ] as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'updateAppointment',
                  appointmentIds: ['appt-1', 'appt-2', 'appt-3'],
                  slotTime: '2099-03-30T17:00:00.000Z',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('all 3 appointments');
    expect(body.results[0].result).toContain('requested status');
    expect(prisma.appointment.update).toHaveBeenCalledTimes(6);
    expect(cancelScheduledAppointmentReminder).toHaveBeenCalledTimes(3);
    expect(sendAppointmentConfirmation).toHaveBeenCalledTimes(3);
    expect(vi.mocked(prisma.appointment.update).mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            where: { id: 'appt-1' },
            data: expect.objectContaining({
              status: 'pending',
              confirmationSent: false,
              reminderSent: false,
              source: 'ai',
              startTime: new Date('2099-03-30T17:00:00.000Z'),
              endTime: new Date('2099-03-30T17:45:00.000Z'),
            }),
          }),
        ],
        [
          expect.objectContaining({
            where: { id: 'appt-2' },
            data: expect.objectContaining({
              startTime: new Date('2099-03-30T17:45:00.000Z'),
              endTime: new Date('2099-03-30T18:30:00.000Z'),
            }),
          }),
        ],
        [
          expect.objectContaining({
            where: { id: 'appt-3' },
            data: expect.objectContaining({
              startTime: new Date('2099-03-30T18:30:00.000Z'),
              endTime: new Date('2099-03-30T19:15:00.000Z'),
            }),
          }),
        ],
        [
          expect.objectContaining({
            where: { id: 'appt-1' },
            data: { confirmationSent: true },
          }),
        ],
        [
          expect.objectContaining({
            where: { id: 'appt-2' },
            data: { confirmationSent: true },
          }),
        ],
        [
          expect.objectContaining({
            where: { id: 'appt-3' },
            data: { confirmationSent: true },
          }),
        ],
      ])
    );
  });

  it('sends one grouped confirmation link when an AI call ends after multiple bookings', async () => {
    vi.mocked(prisma.aiCallSession.findUnique).mockResolvedValueOnce({
      createdAt: new Date('2026-03-10T14:45:00.000Z'),
    } as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValueOnce([
      { id: 'appt-1', customer: { name: 'Jane' } },
      { id: 'appt-2', customer: { name: 'Jane' } },
      { id: 'appt-3', customer: { name: 'Jane' } },
    ] as any);

    const res = await POST(
      req({
        message: {
          type: 'status-update',
          status: 'ended',
          phoneNumber: { id: 'phone-1' },
          call: {
            id: 'call-123',
            customer: { number: '+15551234567' },
          },
        },
      })
    );

    expect(res.status).toBe(200);
    expect(sendAppointmentBatchConfirmation).toHaveBeenCalledWith(
      '5551234567',
      expect.objectContaining({
        businessName: 'Test Salon',
        appointmentCount: 3,
      })
    );
    expect(sendAppointmentConfirmation).not.toHaveBeenCalled();
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['appt-1', 'appt-2', 'appt-3'] } },
      data: { confirmationSent: true },
    });
  });

  it('matches existing AI callers even when the stored customer phone omits +1', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue([{ id: 'cust-1' }] as any);
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([] as any);

    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'getAppointments',
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { phoneLookupKey: '5551234567' },
            { phone: '5551234567' },
            { phone: '+15551234567' },
          ]),
        }),
      })
    );
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: { in: ['cust-1'] },
        }),
      })
    );
  });

  it('caps AI phone appointments at five services during availability checks', async () => {
    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'checkAvailability',
                  date: '2026-03-10',
                  serviceIds: ['svc-1', 'svc-2', 'svc-3', 'svc-4', 'svc-5', 'svc-6'],
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('up to 5 services in one appointment');
    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });

  it('caps AI phone appointments at five services before booking creation', async () => {
    const res = await POST(
      req({
        message: {
          type: 'tool-calls',
          phoneNumber: { id: 'phone-1' },
          call: { customer: { number: '+15551234567' } },
          toolCallList: [
            {
              id: 'tool-1',
              function: {
                name: 'manage_booking',
                arguments: {
                  action: 'createBooking',
                  slotTime: '2026-03-10T15:00:00.000Z',
                  customerName: 'Jane',
                  serviceIds: ['svc-1', 'svc-2', 'svc-3', 'svc-4', 'svc-5', 'svc-6'],
                },
              },
            },
          ],
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].result).toContain('up to 5 services in one appointment');
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });
});
