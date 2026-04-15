import { describe, expect, it } from 'vitest';
import {
  PUBLIC_BOOKING_TRANSACTIONAL_CONSENT_VERSION,
  buildPublicBookingConsentMetadata,
  getPublicBookingTransactionalConsentDisclosure,
} from '@/lib/public-booking-sms-consent';

describe('public booking SMS consent helpers', () => {
  it('formats the transactional booking disclosure with the business name and compliance language', () => {
    const disclosure = getPublicBookingTransactionalConsentDisclosure('Davi Nails');

    expect(disclosure).toContain('Davi Nails');
    expect(disclosure).toContain('request, confirmation, reminder, reschedule, and cancellation updates');
    expect(disclosure).toContain('Reply STOP to opt out, HELP for help.');
  });

  it('captures booking-submission consent metadata for audit logging', () => {
    expect(
      buildPublicBookingConsentMetadata({
        businessName: 'Davi Nails',
        channel: 'public-business-slug-book',
        consentApplied: true,
        ipAddress: '203.0.113.9',
        marketingConsent: false,
        submittedSmsConsentField: false,
        userAgent: 'Mozilla/5.0',
      }),
    ).toMatchObject({
      channel: 'public-business-slug-book',
      consentApplied: true,
      consentDisclosureVersion: PUBLIC_BOOKING_TRANSACTIONAL_CONSENT_VERSION,
      consentMethod: 'booking_submission',
      marketingConsent: false,
      submittedSmsConsentField: false,
      transactionalConsent: true,
      userAgent: 'Mozilla/5.0',
    });
  });
});
