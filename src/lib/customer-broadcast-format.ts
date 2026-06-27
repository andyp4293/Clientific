import { appendSmsComplianceFooter } from '@/lib/sms-compliance';

export function formatCustomerBroadcastSms(args: {
  businessName: string;
  message: string;
}) {
  const businessName = args.businessName.trim() || 'Your business';
  return appendSmsComplianceFooter(`${businessName}: ${args.message.trim()}`);
}
