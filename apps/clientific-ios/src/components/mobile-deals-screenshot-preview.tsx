import React from 'react';
import { Alert } from 'react-native';
import {
  MobileDealsScreen,
} from '@/components/mobile-deals-screen';
import type {
  MobileDealInput,
  MobileDealsSummary,
  MobileServicesSummary,
} from '@/lib/clientific-api';

const screenshotServices: MobileServicesSummary = {
  business: {
    id: 'biz-preview',
    email: 'owner@clientific.app',
    name: 'Davi Nails',
    businessType: 'Nail salon',
    onboardingComplete: true,
  },
  counts: {
    services: 3,
    activeServices: 3,
    staff: 0,
    activeStaff: 0,
  },
  groups: [],
  services: [
    {
      id: 'svc-gel-manicure',
      name: 'Gel manicure',
      description: null,
      duration: 45,
      durationLabel: '45 min',
      price: 45,
      priceLabel: '$45.00',
      isActive: true,
      groupId: null,
      groupName: null,
      sortOrder: 0,
    },
    {
      id: 'svc-pedicure',
      name: 'Spa pedicure',
      description: null,
      duration: 50,
      durationLabel: '50 min',
      price: 48,
      priceLabel: '$48.00',
      isActive: true,
      groupId: null,
      groupName: null,
      sortOrder: 1,
    },
    {
      id: 'svc-full-set',
      name: 'Full set',
      description: null,
      duration: 70,
      durationLabel: '1 hr 10 min',
      price: 65,
      priceLabel: '$65.00',
      isActive: true,
      groupId: null,
      groupName: null,
      sortOrder: 2,
    },
  ],
  staff: [],
};

const screenshotDeals: MobileDealsSummary = {
  business: screenshotServices.business,
  payoutReady: true,
  payoutSetupMessage: null,
  counts: {
    total: 2,
    live: 1,
    scheduled: 1,
    ended: 0,
  },
  deals: [
    {
      id: 'deal-summer-gel',
      title: 'Summer Gel Special',
      description: 'Limited weekday offer for gel manicures.',
      active: true,
      discountType: 'percent_off',
      discountValue: 20,
      discountLabel: '20% off',
      deliveryType: 'purchase_link',
      statusLabel: 'Live',
      statusTone: 'live',
      startsAt: '2026-07-14T00:00:00.000Z',
      startsAtValue: '2026-07-14',
      expiresAt: '2026-07-21T23:59:59.999Z',
      expiresAtValue: '2026-07-21',
      windowLabel: 'Jul 14 - Jul 21',
      deliveryLabel: 'Purchase link',
      serviceScope: 'selected_services',
      eligibleServices: [{ id: 'svc-gel-manicure', name: 'Gel manicure', price: 45 }],
      newCustomersOnly: false,
      maxRedemptions: 30,
      redemptionCount: 8,
      purchasesCount: 8,
      redemptionsCount: 3,
      revenueLabel: '$288.00',
      linkPath: '/d/summer-gel-special',
    },
    {
      id: 'deal-pedicure',
      title: 'Spa Pedicure Upgrade',
      description: 'Scheduled for next week.',
      active: true,
      discountType: 'amount_off',
      discountValue: 10,
      discountLabel: '$10.00 off',
      deliveryType: 'purchase_link',
      statusLabel: 'Scheduled',
      statusTone: 'scheduled',
      startsAt: '2026-07-24T00:00:00.000Z',
      startsAtValue: '2026-07-24',
      expiresAt: '2026-07-31T23:59:59.999Z',
      expiresAtValue: '2026-07-31',
      windowLabel: 'Jul 24 - Jul 31',
      deliveryLabel: 'Purchase link',
      serviceScope: 'selected_services',
      eligibleServices: [{ id: 'svc-pedicure', name: 'Spa pedicure', price: 48 }],
      newCustomersOnly: true,
      maxRedemptions: null,
      redemptionCount: 0,
      purchasesCount: 0,
      redemptionsCount: 0,
      revenueLabel: '$0.00',
      linkPath: '/d/spa-pedicure-upgrade',
    },
  ],
};

async function noopAsync() {}

async function noopDealInput(_input: MobileDealInput) {}

async function noopDealUpdate(_dealId: string, _input: Partial<MobileDealInput>) {}

async function noopDealId(_dealId: string) {}

export function MobileDealsScreenshotPreview() {
  return (
    <MobileDealsScreen
      data={screenshotDeals}
      error={null}
      initialSheetMode="create"
      isDealComposerLoading={false}
      isLoading={false}
      isRefreshing={false}
      onCreateDeal={async (input) => {
        Alert.alert('Preview only', `Would create: ${input.title}`);
        await noopDealInput(input);
      }}
      onDeleteDeal={noopDealId}
      onLoadDealComposerResources={noopAsync}
      onOpenFunds={() => {}}
      onOpenUrl={noopAsync}
      onRefresh={noopAsync}
      onShareDeal={noopAsync}
      onUpdateDeal={noopDealUpdate}
      servicesSummary={screenshotServices}
    />
  );
}
