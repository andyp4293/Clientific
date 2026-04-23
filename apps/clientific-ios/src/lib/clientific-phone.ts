export function formatPhoneForDialing(phone: string | null | undefined): string {
  if (typeof phone !== 'string') return '';

  const trimmed = phone.trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/\D/g, '');
  return digits || trimmed;
}
