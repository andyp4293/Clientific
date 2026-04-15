export const PUBLIC_BOOKING_TRANSACTIONAL_CONSENT_VERSION = '2026-04-15';

export function getPublicBookingTransactionalConsentDisclosure(businessName: string): string {
  return `By submitting this booking request, you agree to receive appointment-related text messages from ${businessName} about this appointment, including request, confirmation, reminder, reschedule, and cancellation updates. Consent is not a condition of purchase. Message and data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help.`;
}

type PublicBookingConsentMetadataInput = {
  businessName: string;
  channel: string;
  consentApplied: boolean;
  ipAddress: string | null;
  marketingConsent: boolean;
  submittedSmsConsentField: boolean;
  userAgent: string | null;
};

export function buildPublicBookingConsentMetadata(
  input: PublicBookingConsentMetadataInput,
) {
  return {
    channel: input.channel,
    consentApplied: input.consentApplied,
    consentDisclosureText: getPublicBookingTransactionalConsentDisclosure(input.businessName),
    consentDisclosureVersion: PUBLIC_BOOKING_TRANSACTIONAL_CONSENT_VERSION,
    consentMethod: 'booking_submission',
    ipAddress: input.ipAddress,
    marketingConsent: input.marketingConsent,
    submittedSmsConsentField: input.submittedSmsConsentField,
    transactionalConsent: true,
    userAgent: input.userAgent,
  };
}
