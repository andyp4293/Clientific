import React from 'react';
import type { PurchasesOffering } from 'react-native-purchases';
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
  isActive: true,
  canPurchaseInApp: false,
  showManageInApp: false,
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

const appStoreOffering = {
  identifier: 'default',
  serverDescription: 'Clientific plans',
  metadata: {},
  availablePackages: [
    {
      identifier: 'starter_monthly',
      packageType: 'MONTHLY',
      offeringIdentifier: 'default',
      presentedOfferingContext: {
        offeringIdentifier: 'default',
        placementIdentifier: null,
        targetingContext: null,
      },
      webCheckoutUrl: null,
      product: {
        identifier: 'clientific_starter_monthly',
        description: 'Starter plan from Apple.',
        title: 'Starter',
        price: 49,
        priceString: '$49.00',
        pricePerWeek: null,
        pricePerMonth: 49,
        pricePerYear: null,
        pricePerWeekString: null,
        pricePerMonthString: '$49.00',
        pricePerYearString: null,
        currencyCode: 'USD',
        introPrice: null,
        discounts: null,
        productCategory: 'SUBSCRIPTION',
        productType: 'AUTO_RENEWABLE_SUBSCRIPTION',
        subscriptionPeriod: 'P1M',
        defaultOption: null,
        subscriptionOptions: null,
        presentedOfferingIdentifier: 'default',
        presentedOfferingContext: {
          offeringIdentifier: 'default',
          placementIdentifier: null,
          targetingContext: null,
        },
      },
    },
  ],
  lifetime: null,
  annual: null,
  sixMonth: null,
  threeMonth: null,
  twoMonth: null,
  monthly: null,
  weekly: null,
} as unknown as PurchasesOffering;

function renderScreen(
  overrides: Partial<React.ComponentProps<typeof MobileBillingScreen>> = {},
) {
  const onOpenUrl = jest.fn().mockResolvedValue(undefined);
  const onPurchasePackage = jest.fn().mockResolvedValue(undefined);
  const onRestorePurchases = jest.fn().mockResolvedValue(undefined);
  const onManageSubscription = jest.fn().mockResolvedValue(undefined);

  render(
    <MobileBillingScreen
      appStoreOffering={null}
      data={data}
      error={null}
      isLoading={false}
      isLoadingOffering={false}
      isManagingSubscription={false}
      isPurchasingSubscription={false}
      isRefreshing={false}
      isRestoringSubscription={false}
      notice={null}
      onManageSubscription={onManageSubscription}
      onOpenUrl={onOpenUrl}
      onPurchasePackage={onPurchasePackage}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
      onRestorePurchases={onRestorePurchases}
      purchaseError={null}
      {...overrides}
    />,
  );

  return {
    onOpenUrl,
    onPurchasePackage,
    onRestorePurchases,
    onManageSubscription,
  };
}

describe('MobileBillingScreen', () => {
  it('shows website-managed billing copy and still opens invoice links', () => {
    const { onOpenUrl } = renderScreen();

    expect(screen.getByText('Billing access')).toBeTruthy();
    expect(screen.getByText('Managed on the web')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-billing-open-invoice-inv-1'));

    expect(onOpenUrl).toHaveBeenCalledWith('https://stripe.com/invoice/inv-1');
    expect(screen.queryByTestId('mobile-billing-manage-subscription')).toBeNull();
  });

  it('shows Apple-managed billing copy and management actions for app store subscriptions', () => {
    const { onManageSubscription, onRestorePurchases } = renderScreen({
      data: {
        ...data,
        billingProvider: 'app_store',
        billingProviderLabel: 'App Store',
        managementTitle: 'Managed by Apple',
        managementSummary:
          'This account is billed through the App Store. Purchases, renewals, and receipts stay managed by Apple.',
        paymentMethodSummary: 'Payment details stay managed by Apple.',
        invoices: [],
        invoiceEmptyState: 'App Store receipts stay available from Apple for this subscription.',
        showManageInApp: true,
      },
    });

    expect(screen.getByText('App Store')).toBeTruthy();
    expect(screen.getByText('Managed by Apple')).toBeTruthy();
    expect(screen.getByText('Payment details stay managed by Apple.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-billing-manage-subscription'));
    fireEvent.press(screen.getByTestId('mobile-billing-restore-existing-purchases'));

    expect(onManageSubscription).toHaveBeenCalled();
    expect(onRestorePurchases).toHaveBeenCalled();
  });

  it('shows the App Store purchase wall for inactive iPhone accounts', () => {
    const { onPurchasePackage, onRestorePurchases } = renderScreen({
      appStoreOffering,
      data: {
        ...data,
        currentPlanName: 'No active plan',
        currentPlanPriceLabel: 'Start a 14-day free trial',
        planSummary:
          'Pick Starter, Pro, or Premium in the app to unlock appointments, customers, deals, and the rest of your business tools.',
        billingProvider: 'none',
        billingProviderLabel: 'No subscription yet',
        managementTitle: 'Start your App Store trial',
        managementSummary:
          'This iPhone account has not started a subscription yet. Pick a plan in the app to unlock the rest of Clientific.',
        subscriptionStatus: 'inactive',
        subscriptionStatusLabel: 'No Subscription',
        isActive: false,
        canPurchaseInApp: true,
        showManageInApp: false,
        paymentMethodSummary: 'Choose a plan in the app to start billing through Apple.',
        invoices: [],
      },
      notice: 'Start the 14-day App Store trial to unlock appointments, customers, deals, and the rest of your business tools.',
    });

    expect(screen.getByText('Choose your plan')).toBeTruthy();
    expect(screen.getByText('Starter')).toBeTruthy();
    expect(screen.getByText('14-day trial')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mobile-billing-purchase-starter_monthly'));
    fireEvent.press(screen.getByTestId('mobile-billing-restore-purchases'));

    expect(onPurchasePackage).toHaveBeenCalled();
    expect(onRestorePurchases).toHaveBeenCalled();
  });
});
