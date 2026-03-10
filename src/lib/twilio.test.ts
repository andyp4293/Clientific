import { describe, it, expect } from 'vitest';
import {
  appendSmsComplianceFooter,
  formatAppointmentBusinessConfirmedSMS,
  formatAppointmentCancellationSMS,
  formatAppointmentConfirmationSMS,
  formatAppointmentReminderSMS,
  formatAppointmentRescheduledSMS,
  formatDealNotificationSMS,
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

  it('formats confirmation times in the provided business timezone', () => {
    const dateTime = new Date('2026-01-15T18:00:00.000Z');
    const nyMessage = formatAppointmentConfirmationSMS({
      customerName: 'Jane',
      serviceName: 'Haircut',
      staffName: 'Sam',
      dateTime,
      businessName: 'Test Salon',
      timezone: 'America/New_York',
    });
    const laMessage = formatAppointmentConfirmationSMS({
      customerName: 'Jane',
      serviceName: 'Haircut',
      staffName: 'Sam',
      dateTime,
      businessName: 'Test Salon',
      timezone: 'America/Los_Angeles',
    });

    expect(nyMessage).toContain('1:00 PM');
    expect(laMessage).toContain('10:00 AM');
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

  it('formats deal notification with polished copy and url', () => {
    const message = formatDealNotificationSMS({
      businessName: 'Test Salon',
      dealTitle: '20% Off Gel Manicure',
      dealUrl: 'https://clientific.app/d/deal-1',
    });

    expect(message).toContain('Test Salon');
    expect(message).toContain('20% Off Gel Manicure');
    expect(message).toContain('https://clientific.app/d/deal-1');
    expect(message).not.toContain('--');
    expect(message).toContain(FOOTER);
  });
});
