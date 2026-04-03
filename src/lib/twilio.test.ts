import { describe, it, expect } from 'vitest';
import {
  appendSmsComplianceFooter,
  formatAppointmentBatchConfirmationSMS,
  formatAppointmentBusinessConfirmedSMS,
  formatAppointmentCancellationSMS,
  formatAppointmentConfirmationSMS,
  formatAppointmentReminderSMS,
  formatAppointmentRescheduledSMS,
  formatDealClaimCodeSMS,
  formatDealPurchaseLinkSMS,
  formatKioskDealClaimSMS,
  formatKioskSignupConfirmationSMS,
  formatReviewRequestSMS,
  isE164PhoneNumber,
  normalizeOptionalPhoneNumber,
} from './twilio';

const FOOTER = 'Reply STOP to opt out, HELP for help.';

describe('twilio sms formatting', () => {
  it('adds footer via helper', () => {
    const message = appendSmsComplianceFooter('Hello there');
    expect(message).toContain(FOOTER);
  });

  it('normalizes a local transfer number into E.164', () => {
    expect(normalizeOptionalPhoneNumber('(908) 727-2437')).toBe('+19087272437');
  });

  it('rejects invalid transfer numbers that cannot be normalized safely', () => {
    expect(normalizeOptionalPhoneNumber('front desk')).toBeNull();
  });

  it('detects whether a number is already in E.164 format', () => {
    expect(isE164PhoneNumber('+19087272437')).toBe(true);
    expect(isE164PhoneNumber('9087272437')).toBe(false);
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

  it('formats grouped appointment confirmation links', () => {
    const message = formatAppointmentBatchConfirmationSMS({
      customerName: 'Jane',
      businessName: 'Test Salon',
      appointmentCount: 3,
      appointmentUrl: 'https://clientific.app/a/ab1.token.sig',
    });

    expect(message).toContain('3 appointment requests');
    expect(message).toContain('https://clientific.app/a/ab1.token.sig');
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
      appointmentUrl: 'https://www.clientific.app/a/ABC1234',
    });
    expect(message).toContain('Details: https://www.clientific.app/a/ABC1234');
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
      surveyUrl: 'https://clientific.app/feedback/test-salon?token=abc123',
    });
    expect(message).toContain('thanks for visiting today');
    expect(message).toContain('quick rating');
    expect(message).toContain('https://clientific.app/feedback/test-salon?token=abc123');
    expect(message).toContain(FOOTER);
  });

  // ── Deal claim code SMS ─────────────────────────────────────────────────────

  it('formatDealClaimCodeSMS — percent_off all services', () => {
    const message = formatDealClaimCodeSMS({
      businessName: 'Test Salon',
      customerName: 'Jane Doe',
      dealTitle: 'Spring Special',
      dealCode: 'ABCD1234',
      bookingUrl: 'https://clientific.app/book/test-salon',
      discountType: 'percent_off',
      discountValue: 20,
      serviceScope: 'all_services',
    });
    expect(message).toContain('Hi Jane,');
    expect(message).toContain('sent you a deal: Spring Special — 20% off any service');
    expect(message).toContain('Your code is ABCD1234');
    expect(message).toContain('Book here: https://clientific.app/book/test-salon');
    expect(message).toContain(FOOTER);
  });

  it('formatDealClaimCodeSMS — amount_off single service', () => {
    const message = formatDealClaimCodeSMS({
      businessName: 'Test Salon',
      customerName: 'Jane Doe',
      dealTitle: 'Summer Cut Deal',
      dealCode: 'XY99',
      discountType: 'amount_off',
      discountValue: 15,
      serviceScope: 'selected_services',
      serviceName: 'Haircut',
    });
    expect(message).toContain('sent you a deal: Summer Cut Deal — $15 off Haircut');
    expect(message).toContain('Your code is XY99');
  });

  it('formatDealClaimCodeSMS — amount_off multiple (select services)', () => {
    const message = formatDealClaimCodeSMS({
      businessName: 'Test Salon',
      customerName: 'Jane',
      dealTitle: 'Bundle Deal',
      dealCode: 'BND1',
      discountType: 'amount_off',
      discountValue: 25,
      serviceScope: 'selected_services',
      serviceName: null, // multiple eligible services
    });
    expect(message).toContain('$25 off select services');
  });

  it('formatDealClaimCodeSMS — free_service', () => {
    const message = formatDealClaimCodeSMS({
      businessName: 'Test Salon',
      customerName: 'Jane',
      dealTitle: 'Free Blowout',
      dealCode: 'FREE1',
      discountType: 'free_service',
      serviceName: 'Blowout',
    });
    expect(message).toContain('free Blowout');
  });

  // ── Deal purchase link SMS ───────────────────────────────────────────────────

  it('formatDealPurchaseLinkSMS — percent_off all services', () => {
    const message = formatDealPurchaseLinkSMS({
      businessName: 'Test Salon',
      customerName: 'Jane Doe',
      dealTitle: 'Spring Special',
      dealUrl: 'https://clientific.app/d/deal-1',
      discountType: 'percent_off',
      discountValue: 50,
      serviceScope: 'all_services',
    });
    expect(message).toContain('Hi Jane,');
    expect(message).toContain('sent you a deal: Spring Special — 50% off any service');
    expect(message).toContain('Claim it here: https://clientific.app/d/deal-1');
    expect(message).toContain(FOOTER);
  });

  it('formatDealPurchaseLinkSMS — dollar off single service', () => {
    const message = formatDealPurchaseLinkSMS({
      businessName: 'Test Salon',
      customerName: 'Bob Smith',
      dealTitle: 'Color Deal',
      dealUrl: 'https://clientific.app/d/deal-2',
      discountType: 'amount_off',
      discountValue: 30,
      serviceScope: 'selected_services',
      serviceName: 'Color',
    });
    expect(message).toContain('Hi Bob,');
    expect(message).toContain('sent you a deal: Color Deal — $30 off Color');
    expect(message).toContain('Claim it here: https://clientific.app/d/deal-2');
  });

  it('formatDealPurchaseLinkSMS — select services (multiple eligible)', () => {
    const message = formatDealPurchaseLinkSMS({
      businessName: 'Test Salon',
      dealTitle: 'Multi Deal',
      dealUrl: 'https://clientific.app/d/deal-3',
      discountType: 'percent_off',
      discountValue: 10,
      serviceScope: 'selected_services',
      serviceName: null,
    });
    expect(message).toContain('10% off select services');
  });

  it('formatDealPurchaseLinkSMS — falls back gracefully when no discount fields provided', () => {
    const message = formatDealPurchaseLinkSMS({
      businessName: 'Test Salon',
      dealTitle: 'Spring Special',
      dealUrl: 'https://clientific.app/d/deal-1',
    });
    expect(message).toContain('sent you a deal: Spring Special');
    expect(message).toContain('Claim it here:');
    expect(message).toContain(FOOTER);
  });

  it('formats kiosk signup confirmation with optional booking link', () => {
    const message = formatKioskSignupConfirmationSMS({
      businessName: 'Test Salon',
      customerName: 'Jane Doe',
      bookingUrl: 'https://clientific.app/book/test-salon',
    });

    expect(message).toContain('Hi Jane, thanks for signing up with Test Salon.');
    expect(message).toContain("You're now on the Test Salon text list for offers and updates.");
    expect(message).toContain('Book anytime: https://clientific.app/book/test-salon');
    expect(message).toContain(FOOTER);
  });

  it('formats kiosk deal claim confirmation with the redemption code', () => {
    const message = formatKioskDealClaimSMS({
      businessName: 'Test Salon',
      customerName: 'Jane Doe',
      dealTitle: 'Spring Special',
      dealCode: 'ABCD1234',
      bookingUrl: 'https://clientific.app/book/test-salon',
    });

    expect(message).toContain('Hi Jane,');
    expect(message).toContain('thanks for signing up with Test Salon.');
    expect(message).toContain("You're now on the Test Salon text list for future offers and updates.");
    expect(message).toContain('Your Spring Special code is ABCD1234.');
    expect(message).toContain('Book here: https://clientific.app/book/test-salon');
    expect(message).toContain(FOOTER);
  });
});
