import { describe, it, expect } from 'vitest';
import {
  appendSmsComplianceFooter,
  formatAppointmentBusinessConfirmedSMS,
  formatAppointmentCancellationSMS,
  formatAppointmentConfirmationSMS,
  formatAppointmentReminderSMS,
  formatAppointmentRescheduledSMS,
  formatReviewRequestSMS,
} from './twilio';

const FOOTER = 'Reply STOP to opt out, HELP for help.';

describe('twilio sms formatting', () => {
  it('adds footer via helper', () => {
    const message = appendSmsComplianceFooter('Hello there');
    expect(message).toContain(FOOTER);
  });

  it('includes footer on appointment confirmation', () => {
    const message = formatAppointmentConfirmationSMS({
      customerName: 'Jane',
      serviceName: 'Haircut',
      staffName: 'Sam',
      dateTime: new Date('2026-03-10T14:00:00.000Z'),
      businessName: 'Test Salon',
    });
    expect(message).toContain(FOOTER);
  });

  it('includes footer on business confirmed template', () => {
    const message = formatAppointmentBusinessConfirmedSMS({
      customerName: 'Jane',
      serviceName: 'Haircut',
      dateTime: new Date('2026-03-10T14:00:00.000Z'),
      businessName: 'Test Salon',
    });
    expect(message).toContain(FOOTER);
  });

  it('includes footer on reminder template', () => {
    const message = formatAppointmentReminderSMS({
      customerName: 'Jane',
      serviceName: 'Haircut',
      staffName: 'Sam',
      dateTime: new Date('2026-03-10T14:00:00.000Z'),
      businessName: 'Test Salon',
    });
    expect(message).toContain(FOOTER);
  });

  it('includes footer on cancellation template', () => {
    const message = formatAppointmentCancellationSMS({
      customerName: 'Jane',
      serviceName: 'Haircut',
      dateTime: new Date('2026-03-10T14:00:00.000Z'),
      businessName: 'Test Salon',
    });
    expect(message).toContain(FOOTER);
  });

  it('includes footer on rescheduled template', () => {
    const message = formatAppointmentRescheduledSMS({
      customerName: 'Jane',
      serviceName: 'Haircut',
      businessName: 'Test Salon',
      newDateTime: new Date('2026-03-11T14:00:00.000Z'),
    });
    expect(message).toContain(FOOTER);
  });

  it('includes footer on review request template', () => {
    const message = formatReviewRequestSMS({
      customerName: 'Jane',
      businessName: 'Test Salon',
      googleReviewUrl: 'https://example.com/review',
    });
    expect(message).toContain(FOOTER);
  });
});
