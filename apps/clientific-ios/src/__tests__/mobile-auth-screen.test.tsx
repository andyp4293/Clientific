import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MobileAuthScreen } from '@/components/mobile-auth-screen';

describe('MobileAuthScreen', () => {
  it('captures sign-in credentials and submits them', () => {
    const onLogin = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileAuthScreen
        error={null}
        isResendingCode={false}
        isSubmitting={false}
        mode="sign-in"
        notice={null}
        onOpenPrivacyPolicy={jest.fn().mockResolvedValue(undefined)}
        onOpenTermsOfService={jest.fn().mockResolvedValue(undefined)}
        verificationEmail=""
        onBackToSignIn={jest.fn()}
        onLogin={onLogin}
        onModeChange={jest.fn()}
        onRegister={jest.fn().mockResolvedValue(undefined)}
        onResendCode={jest.fn().mockResolvedValue(undefined)}
        onVerify={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-login-email'), 'owner@clientific.app');
    fireEvent.changeText(screen.getByTestId('mobile-login-password'), 'secret123!');
    fireEvent.press(screen.getByTestId('mobile-login-submit'));

    expect(onLogin).toHaveBeenCalledWith('owner@clientific.app', 'secret123!');
  });

  it('switches to registration and submits the new account payload', () => {
    const onRegister = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileAuthScreen
        error={null}
        isResendingCode={false}
        isSubmitting={false}
        mode="register"
        notice={null}
        onOpenPrivacyPolicy={jest.fn().mockResolvedValue(undefined)}
        onOpenTermsOfService={jest.fn().mockResolvedValue(undefined)}
        verificationEmail=""
        onBackToSignIn={jest.fn()}
        onLogin={jest.fn().mockResolvedValue(undefined)}
        onModeChange={jest.fn()}
        onRegister={onRegister}
        onResendCode={jest.fn().mockResolvedValue(undefined)}
        onVerify={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-register-business-name'), 'North Studio');
    fireEvent.changeText(screen.getByTestId('mobile-register-email'), 'owner@northstudio.com');
    fireEvent.changeText(screen.getByTestId('mobile-register-password'), 'secret123!');
    fireEvent.changeText(screen.getByTestId('mobile-register-confirm-password'), 'secret123!');
    fireEvent.press(screen.getByTestId('mobile-register-accept-terms'));
    fireEvent.press(screen.getByTestId('mobile-register-submit'));

    expect(onRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'North Studio',
        businessType: 'Salon',
        email: 'owner@northstudio.com',
        password: 'secret123!',
        confirmPassword: 'secret123!',
        acceptTerms: true,
      }),
    );
  });

  it('handles verification actions', () => {
    const onVerify = jest.fn().mockResolvedValue(undefined);
    const onResendCode = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileAuthScreen
        error={null}
        isResendingCode={false}
        isSubmitting={false}
        mode="verify"
        notice={null}
        onOpenPrivacyPolicy={jest.fn().mockResolvedValue(undefined)}
        onOpenTermsOfService={jest.fn().mockResolvedValue(undefined)}
        verificationEmail="owner@clientific.app"
        onBackToSignIn={jest.fn()}
        onLogin={jest.fn().mockResolvedValue(undefined)}
        onModeChange={jest.fn()}
        onRegister={jest.fn().mockResolvedValue(undefined)}
        onResendCode={onResendCode}
        onVerify={onVerify}
      />,
    );

    fireEvent.changeText(screen.getByTestId('mobile-verify-code'), '123456');
    fireEvent.press(screen.getByTestId('mobile-verify-submit'));
    fireEvent.press(screen.getByTestId('mobile-verify-resend'));

    expect(onVerify).toHaveBeenCalledWith('owner@clientific.app', '123456');
    expect(onResendCode).toHaveBeenCalledWith('owner@clientific.app');
  });

  it('opens privacy and terms links from the auth flow', () => {
    const onOpenPrivacyPolicy = jest.fn().mockResolvedValue(undefined);
    const onOpenTermsOfService = jest.fn().mockResolvedValue(undefined);

    render(
      <MobileAuthScreen
        error={null}
        isResendingCode={false}
        isSubmitting={false}
        mode="register"
        notice={null}
        onOpenPrivacyPolicy={onOpenPrivacyPolicy}
        onOpenTermsOfService={onOpenTermsOfService}
        verificationEmail=""
        onBackToSignIn={jest.fn()}
        onLogin={jest.fn().mockResolvedValue(undefined)}
        onModeChange={jest.fn()}
        onRegister={jest.fn().mockResolvedValue(undefined)}
        onResendCode={jest.fn().mockResolvedValue(undefined)}
        onVerify={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.press(screen.getByTestId('mobile-register-open-terms'));
    fireEvent.press(screen.getByTestId('mobile-register-open-privacy'));
    fireEvent.press(screen.getByTestId('mobile-auth-open-terms'));
    fireEvent.press(screen.getByTestId('mobile-auth-open-privacy'));

    expect(onOpenTermsOfService).toHaveBeenCalledTimes(2);
    expect(onOpenPrivacyPolicy).toHaveBeenCalledTimes(2);
  });
});
