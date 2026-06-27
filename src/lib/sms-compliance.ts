export const SMS_COMPLIANCE_FOOTER = 'Reply STOP to opt out, HELP for help.';

export function appendSmsComplianceFooter(message: string): string {
  const trimmed = message.trim();
  const alreadyHasFooter =
    /reply\s+stop\s+to\s+opt\s*out[, ]+\s*help\s+for\s+help\.?$/i.test(trimmed) ||
    /reply\s+stop\s+to\s+opt\s*out\.?$/i.test(trimmed);

  if (alreadyHasFooter) return trimmed;
  return `${trimmed} ${SMS_COMPLIANCE_FOOTER}`;
}
