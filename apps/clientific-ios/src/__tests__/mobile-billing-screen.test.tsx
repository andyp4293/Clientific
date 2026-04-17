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
  billingProvider: 'stripe' as const,
  billingProviderLabel: 'Website',
  managementTitle: 'Managed on the web',
  managementSummary:
    'This account started on the web. Plan changes and subscription management still happen in Clientific on the web.',
  subscriptionStatus: 'active',
  subscriptionStatusLabel: 'Active',
  trialDaysRemaining: null,
  trialEndsAtLabel: null,
  nextBillingDateLabel: 'April 30, 2026',
  paymentMethodSummary: 'VISA ending in 4242',
  invoiceEmptyState: 'No invoices have posted yet.',
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
  it('shows website-managed billing copy and still opens invoice links', () => {
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileBillingScreen
        data={data}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onOpenUrl={onOpenUrl}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Billing access')).toBeTruthy();
    expect(screen.getByText('Managed on the web')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-billing-open-invoice-inv-1'));

    expect(onOpenUrl).toHaveBeenCalledWith('https://stripe.com/invoice/inv-1');
  });

  it('shows Apple-managed billing copy for app store subscriptions', () => {
    render(
      <MobileBillingScreen
        data={{
          ...data,
          billingProvider: 'app_store',
          billingProviderLabel: 'App Store',
          managementTitle: 'Managed by Apple',
          managementSummary:
            'This account is billed through the App Store. Purchases, renewals, and receipts stay managed by Apple.',
          paymentMethodSummary: 'Payment details stay managed by Apple.',
          invoices: [],
          invoiceEmptyState: 'App Store receipts stay available from Apple for this subscription.',
        }}
        error={null}
        isLoading={false}
        isRefreshing={false}
        onOpenUrl={jest.fn().mockResolvedValue(undefined)}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('App Store')).toBeTruthy();
    expect(screen.getByText('Managed by Apple')).toBeTruthy();
    expect(screen.getByText('Payment details stay managed by Apple.')).toBeTruthy();
    expect(
      screen.getByText('App Store receipts stay available from Apple for this subscription.'),
    ).toBeTruthy();
  });
});
