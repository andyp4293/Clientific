export function sanitizeStripeEnvValue(value: string | null | undefined, fallback = '') {
  const resolved = value ?? fallback;
  return resolved.replace(/^(?:\s|\\r|\\n)+|(?:\s|\\r|\\n)+$/g, '');
}
