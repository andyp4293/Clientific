import { describe, expect, it } from 'vitest';
import { formatCustomerBroadcastSms } from '@/lib/customer-broadcast-format';

describe('formatCustomerBroadcastSms', () => {
  it('starts with the business name and appends the SMS compliance footer', () => {
    expect(
      formatCustomerBroadcastSms({
        businessName: 'Test Salon',
        message: 'We have two openings this afternoon.',
      }),
    ).toBe('Test Salon: We have two openings this afternoon. Reply STOP to opt out, HELP for help.');
  });

  it('does not duplicate an existing opt-out footer', () => {
    expect(
      formatCustomerBroadcastSms({
        businessName: 'Test Salon',
        message: 'We have two openings this afternoon. Reply STOP to opt out, HELP for help.',
      }),
    ).toBe('Test Salon: We have two openings this afternoon. Reply STOP to opt out, HELP for help.');
  });

  it('falls back to a readable business name when the stored name is blank', () => {
    expect(
      formatCustomerBroadcastSms({
        businessName: '   ',
        message: 'We have two openings this afternoon.',
      }),
    ).toBe('Your business: We have two openings this afternoon. Reply STOP to opt out, HELP for help.');
  });
});
