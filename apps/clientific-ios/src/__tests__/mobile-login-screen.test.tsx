import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileLoginScreen } from '@/components/mobile-login-screen';

describe('MobileLoginScreen', () => {
  it('captures credentials and submits them', () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileLoginScreen
        error={null}
        isLoading={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-login-email'), 'owner@clientific.app');
    fireEvent.changeText(screen.getByTestId('mobile-login-password'), 'secret');
    fireEvent.press(screen.getByTestId('mobile-login-submit'));

    expect(onSubmit).toHaveBeenCalledWith('owner@clientific.app', 'secret');
  });

  it('shows the incoming error message', () => {
    render(
      <MobileLoginScreen
        error="Email or password is incorrect"
        isLoading={false}
        onSubmit={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Email or password is incorrect')).toBeTruthy();
  });
});
