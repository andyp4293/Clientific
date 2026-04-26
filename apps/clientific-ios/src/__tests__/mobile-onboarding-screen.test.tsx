import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileOnboardingScreen } from '@/components/mobile-onboarding-screen';

const profile = {
  id: 'biz-1',
  email: 'owner@clientific.app',
  name: 'Clientific Studio',
  businessType: 'Salon',
  onboardingComplete: false,
  ownerPhone: null,
  phone: null,
  businessEmail: null,
  street: null,
  city: null,
  state: null,
  zipCode: null,
  country: 'United States',
  timezone: 'America/New_York',
};

describe('MobileOnboardingScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('submits the onboarding form', () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileOnboardingScreen
        error={null}
        isSaving={false}
        profile={profile}
        onSignOut={jest.fn().mockResolvedValue(undefined)}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-onboarding-phone'), '(555) 123-4567');
    fireEvent.changeText(screen.getByTestId('mobile-onboarding-street'), '123 Main St');
    fireEvent.changeText(screen.getByTestId('mobile-onboarding-city'), 'New York');
    fireEvent.changeText(screen.getByTestId('mobile-onboarding-state'), 'NY');
    fireEvent.changeText(screen.getByTestId('mobile-onboarding-zip'), '10001');
    fireEvent.changeText(screen.getByTestId('mobile-onboarding-country'), 'United States');
    fireEvent.press(screen.getByTestId('mobile-onboarding-submit'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '(555) 123-4567',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'United States',
      }),
    );
  });

  it('shows account deletion in settings mode and confirms before deleting', () => {
    const onDeleteAccount = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_, __, buttons) => {
      const destructiveAction = buttons?.find((button) => button.style === 'destructive');
      destructiveAction?.onPress?.();
    });

    render(
      <MobileOnboardingScreen
        context="settings"
        error={null}
        isDeletingAccount={false}
        isSaving={false}
        onBack={jest.fn()}
        onDeleteAccount={onDeleteAccount}
        profile={{ ...profile, onboardingComplete: true }}
        onSignOut={jest.fn().mockResolvedValue(undefined)}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-settings-delete-account'));

    expect(alertSpy).toHaveBeenCalled();
    expect(onDeleteAccount).toHaveBeenCalled();
  });
});
