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

  it('lets the user show and hide the sign-in password while typing', () => {
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
        onLogin={jest.fn().mockResolvedValue(undefined)}
        onModeChange={jest.fn()}
        onRegister={jest.fn().mockResolvedValue(undefined)}
        onResendCode={jest.fn().mockResolvedValue(undefined)}
        onVerify={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('mobile-login-password').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('mobile-login-password-visibility'));

    expect(screen.getByTestId('mobile-login-password').props.secureTextEntry).toBe(false);

    fireEvent.press(screen.getByTestId('mobile-login-password-visibility'));

    expect(screen.getByTestId('mobile-login-password').props.secureTextEntry).toBe(true);
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
    fireEvent.press(screen.getByTestId('mobile-register-type-Family Law'));
    fireEvent.changeText(screen.getByTestId('mobile-register-email'), 'owner@northstudio.com');
    fireEvent.changeText(screen.getByTestId('mobile-register-password'), 'secret123!');
    fireEvent.changeText(screen.getByTestId('mobile-register-confirm-password'), 'secret123!');
    fireEvent.press(screen.getByTestId('mobile-register-accept-terms'));
    fireEvent.press(screen.getByTestId('mobile-register-submit'));

    expect(onRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'North Studio',
        businessType: 'Family Law',
        email: 'owner@northstudio.com',
        password: 'secret123!',
        confirmPassword: 'secret123!',
        acceptTerms: true,
      }),
    );
  });

  it('passes a pasted referral invite link through the registration payload', () => {
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

    fireEvent.changeText(screen.getByTestId('mobile-register-business-name'), 'Referred Studio');
    fireEvent.changeText(screen.getByTestId('mobile-register-email'), 'owner@referred.com');
    fireEvent.changeText(screen.getByTestId('mobile-register-password'), 'secret123!');
    fireEvent.changeText(screen.getByTestId('mobile-register-confirm-password'), 'secret123!');
    fireEvent.changeText(
      screen.getByTestId('mobile-register-referral-code'),
      'https://www.clientific.app/register?ref=abcd1234',
    );
    fireEvent.press(screen.getByTestId('mobile-register-accept-terms'));
    fireEvent.press(screen.getByTestId('mobile-register-submit'));

    expect(onRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Referred Studio',
        referralCode: 'https://www.clientific.app/register?ref=abcd1234',
      }),
    );
  });

  it('lets the user reveal both registration password fields', () => {
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
        onRegister={jest.fn().mockResolvedValue(undefined)}
        onResendCode={jest.fn().mockResolvedValue(undefined)}
        onVerify={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId('mobile-register-password').props.secureTextEntry).toBe(true);
    expect(screen.getByTestId('mobile-register-confirm-password').props.secureTextEntry).toBe(
      true,
    );

    fireEvent.press(screen.getByTestId('mobile-register-password-visibility'));
    fireEvent.press(screen.getByTestId('mobile-register-confirm-password-visibility'));

    expect(screen.getByTestId('mobile-register-password').props.secureTextEntry).toBe(false);
    expect(screen.getByTestId('mobile-register-confirm-password').props.secureTextEntry).toBe(
      false,
    );
  });

  it('explains that signup accepts either a referral link or a fallback code', () => {
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
        onRegister={jest.fn().mockResolvedValue(undefined)}
        onResendCode={jest.fn().mockResolvedValue(undefined)}
        onVerify={jest.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Referral link or code (optional)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Paste invite link or code')).toBeTruthy();
    expect(
      screen.getByText(
        /paste the full invite link if someone shared it with you/i,
      ),
    ).toBeTruthy();
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
