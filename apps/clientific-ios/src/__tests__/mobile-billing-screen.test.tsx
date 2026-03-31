import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileBillingScreen } from '@/components/mobile-billing-screen';

const data = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  currentPlanName: 'Starter',
  currentPlanPriceLabel: '$49/month',
  planSummary: 'For solo teams getting started.',
  subscriptionStatus: 'active',
  subscriptionStatusLabel: 'Active',
  trialDaysRemaining: null,
  trialEndsAtLabel: null,
  nextBillingDateLabel: 'April 30, 2026',
  paymentMethod: {
    brand: 'visa',
    last4: '4242',
    expMonth: 12,
    expYear: 2028,
    label: 'VISA ending in 4242',
  },
  invoices: [
    {
      id: 'inv-1',
      amountLabel: '$49.00',
      createdLabel: 'Mar 30, 2026',
      status: 'paid',
      statusLabel: 'Paid',
      description: 'Starter plan',
      hostedInvoiceUrl: 'https://stripe.com/invoice/inv-1',
      invoicePdf: null,
    },
  ],
};

describe('MobileBillingScreen', () => {
  it('opens the billing portal and invoice links', () => {
    const onOpenPortal = jest.fn().mockResolvedValue(undefined);
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileBillingScreen
        data={data}
        error={null}
        isLoading={false}
        isOpeningPortal={false}
        isRefreshing={false}
        onOpenPortal={onOpenPortal}
        onOpenUrl={onOpenUrl}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-billing-open-portal'));
    fireEvent.press(screen.getByTestId('mobile-billing-open-invoice-inv-1'));

    expect(onOpenPortal).toHaveBeenCalled();
    expect(onOpenUrl).toHaveBeenCalledWith('https://stripe.com/invoice/inv-1');
  });
});
