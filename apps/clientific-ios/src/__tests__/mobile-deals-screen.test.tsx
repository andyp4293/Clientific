import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { MobileDealsScreen } from '@/components/mobile-deals-screen';
import type { MobileDealsSummary, MobileServicesSummary } from '@/lib/clientific-api';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

const servicesSummary: MobileServicesSummary = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
  counts: {
    services: 2,
    activeServices: 2,
    staff: 0,
    activeStaff: 0,
  },
  groups: [],
  services: [
    {
      id: 'svc-1',
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
      id: 'svc-2',
      name: 'Pedicure',
      description: null,
      duration: 60,
      durationLabel: '1 hr',
      price: 55,
      priceLabel: '$55.00',
      isActive: true,
      groupId: null,
      groupName: null,
      sortOrder: 1,
    },
  ],
  staff: [],
};

const data: MobileDealsSummary = {
  business: {
    id: 'biz-1',
    email: 'owner@clientific.app',
    name: 'Clientific Studio',
    businessType: 'Salon',
    onboardingComplete: true,
  },
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
      id: 'deal-1',
      title: 'Spring Special',
      description: 'Bring in new clients.',
      active: true,
      discountType: 'percent_off',
      discountValue: 20,
      discountLabel: '20% off',
      deliveryType: 'purchase_link',
      statusLabel: 'Live',
      statusTone: 'live',
      startsAt: '2026-03-28T00:00:00.000Z',
      startsAtValue: '2026-03-28',
      expiresAt: '2026-04-04T23:59:59.999Z',
      expiresAtValue: '2026-04-04',
      windowLabel: 'Mar 28 - Apr 4',
      deliveryLabel: 'Purchase link',
      serviceScope: 'selected_services',
      eligibleServices: [{ id: 'svc-1', name: 'Gel manicure', price: 45 }],
      newCustomersOnly: false,
      maxRedemptions: 25,
      redemptionCount: 3,
      purchasesCount: 2,
      redemptionsCount: 1,
      revenueLabel: '$95.00',
      linkPath: '/d/deal-1',
    },
  ],
};

function renderScreen(overrides?: Partial<React.ComponentProps<typeof MobileDealsScreen>>) {
  return render(
    <MobileDealsScreen
      data={data}
      error={null}
      isDealComposerLoading={false}
      isLoading={false}
      isRefreshing={false}
      onCreateDeal={jest.fn().mockResolvedValue(undefined)}
      onDeleteDeal={jest.fn().mockResolvedValue(undefined)}
      onLoadDealComposerResources={jest.fn().mockResolvedValue(undefined)}
      onOpenFunds={jest.fn()}
      onOpenUrl={jest.fn().mockResolvedValue(undefined)}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
      onShareDeal={jest.fn().mockResolvedValue(undefined)}
      onUpdateDeal={jest.fn().mockResolvedValue(undefined)}
      servicesSummary={servicesSummary}
      {...overrides}
    />,
  );
}

describe('MobileDealsScreen', () => {
  it('renders deal metrics and share actions', () => {
    const onShareDeal = jest.fn().mockResolvedValue(undefined);
    const onOpenUrl = jest.fn().mockResolvedValue(undefined);

    renderScreen({ onOpenUrl, onShareDeal });

    expect(screen.getByText('Mobile deal board')).toBeTruthy();
    expect(screen.getByText('Spring Special')).toBeTruthy();
    expect(screen.getByText('Gel manicure')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-deal-share-deal-1'));
    expect(onShareDeal).toHaveBeenCalledWith(data.deals[0]);

    fireEvent.press(screen.getByTestId('mobile-deal-copy-deal-1'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'https://www.clientific.app/d/deal-1',
    );

    fireEvent.press(screen.getByTestId('mobile-deal-open-deal-1'));
    expect(onOpenUrl).toHaveBeenCalledWith('https://www.clientific.app/d/deal-1');
  });

  it('replaces the web-dashboard empty state with native deal creation', async () => {
    const emptyData: MobileDealsSummary = {
      ...data,
      counts: { total: 0, live: 0, scheduled: 0, ended: 0 },
      deals: [],
    };

    renderScreen({ data: emptyData });

    expect(screen.queryByText(/web dashboard/i)).toBeNull();
    expect(screen.getByText('Start the first purchase-link offer directly from the mobile app.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('mobile-empty-create-deal'));

    await waitFor(() => {
      expect(screen.getByTestId('mobile-deal-title-input')).toBeTruthy();
    });
    expect(screen.queryByText(/web dashboard/i)).toBeNull();
  });

  it('creates a selected-service deal from the native form', async () => {
    const onCreateDeal = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onCreateDeal });

    fireEvent.press(screen.getByTestId('mobile-open-deal-sheet'));
    fireEvent.changeText(screen.getByTestId('mobile-deal-title-input'), 'Summer gel special');
    fireEvent.press(screen.getByTestId('mobile-deal-service-scope-selected'));
    fireEvent.press(screen.getByTestId('mobile-deal-service-svc-1'));
    fireEvent.changeText(screen.getByTestId('mobile-deal-max-input'), '30');
    fireEvent.press(screen.getByTestId('mobile-save-deal'));

    await waitFor(() => {
      expect(onCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Summer gel special',
          discountType: 'percent_off',
          discountValue: 20,
          deliveryType: 'purchase_link',
          serviceScope: 'selected_services',
          eligibleServiceIds: ['svc-1'],
          maxRedemptions: 30,
        }),
      );
    });
  });

  it('validates free-service deals before saving', async () => {
    const onCreateDeal = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onCreateDeal });

    fireEvent.press(screen.getByTestId('mobile-open-deal-sheet'));
    fireEvent.changeText(screen.getByTestId('mobile-deal-title-input'), 'Free pedicure');
    fireEvent.press(screen.getByTestId('mobile-deal-discount-free'));
    fireEvent.press(screen.getByTestId('mobile-save-deal'));

    expect(onCreateDeal).not.toHaveBeenCalled();
    expect(screen.getByText('Free service deals must target exactly one service.')).toBeTruthy();
  });

  it('pauses and edits existing deals from native controls', async () => {
    const onUpdateDeal = jest.fn().mockResolvedValue(undefined);
    renderScreen({ onUpdateDeal });

    fireEvent.press(screen.getByTestId('mobile-deal-toggle-deal-1'));
    await waitFor(() => {
      expect(onUpdateDeal).toHaveBeenCalledWith('deal-1', { active: false });
    });

    fireEvent.press(screen.getByTestId('mobile-deal-edit-deal-1'));
    fireEvent.changeText(screen.getByTestId('mobile-deal-title-input'), 'Updated special');
    fireEvent.press(screen.getByTestId('mobile-save-deal'));

    await waitFor(() => {
      expect(onUpdateDeal).toHaveBeenCalledWith(
        'deal-1',
        expect.objectContaining({
          title: 'Updated special',
          serviceScope: 'selected_services',
          eligibleServiceIds: ['svc-1'],
        }),
      );
    });
  });

  it('keeps delete behind a native confirmation', () => {
    const onDeleteDeal = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.[1]?.onPress?.();
    });

    renderScreen({ onDeleteDeal });

    fireEvent.press(screen.getByTestId('mobile-deal-delete-deal-1'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete deal?',
      expect.any(String),
      expect.any(Array),
    );
    expect(onDeleteDeal).toHaveBeenCalledWith('deal-1');

    alertSpy.mockRestore();
  });
});
