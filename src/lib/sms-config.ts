/**
 * Centralized SMS configuration.
 *
 * PLATFORM_SMS_NUMBER is the single Twilio number used for ALL outbound SMS
 * across the entire application — deal broadcasts, appointment confirmations,
 * birthday campaigns, customer replies, etc.
 *
 * To change the number: update the TWILIO_PHONE_NUMBER environment variable
 * in Vercel (and here as the fallback). One change affects everything.
 */
export const PLATFORM_SMS_NUMBER = process.env.TWILIO_PHONE_NUMBER ?? '+18557654989';
