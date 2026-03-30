import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  ClientificApiError,
  confirmVerificationCode,
  fetchMobileBusinessProfile,
  fetchMobileFunds,
  fetchMobileHomeSummary,
  fetchMobileReferrals,
  getClientificWebUrl,
  MobileBusinessProfile,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileLoginResponse,
  MobileOnboardingInput,
  MobileReferralsSummary,
  loginWithClientific,
  registerWithClientific,
  resendVerificationCode,
  updateMobileBusinessProfile,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileAppShell, type MobileAppTab } from '@/components/mobile-app-shell';
import {
  MobileAuthScreen,
  type MobileAuthMode,
  type MobileRegistrationForm,
} from '@/components/mobile-auth-screen';
import { MobileOnboardingScreen } from '@/components/mobile-onboarding-screen';

const MOBILE_SESSION_TOKEN_KEY = 'clientific.mobile.session.token';

function getReadableError(error: unknown, fallback: string) {
  if (error instanceof ClientificApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function ClientificNativeApp() {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [isBooting, setIsBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<MobileAppTab>('home');
  const [authMode, setAuthMode] = useState<MobileAuthMode>('sign-in');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [isRefreshingHome, setIsRefreshingHome] = useState(false);
  const [isLoadingBusinessProfile, setIsLoadingBusinessProfile] = useState(false);
  const [isSavingBusinessProfile, setIsSavingBusinessProfile] = useState(false);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [isRefreshingReferrals, setIsRefreshingReferrals] = useState(false);
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);
  const [isRefreshingFunds, setIsRefreshingFunds] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [businessProfileError, setBusinessProfileError] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [referralsError, setReferralsError] = useState<string | null>(null);
  const [fundsError, setFundsError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [session, setSession] = useState<MobileLoginResponse | null>(null);
  const [businessProfile, setBusinessProfile] = useState<MobileBusinessProfile | null>(null);
  const [home, setHome] = useState<MobileHomeSummary | null>(null);
  const [referrals, setReferrals] = useState<MobileReferralsSummary | null>(null);
  const [funds, setFunds] = useState<MobileFundsSummary | null>(null);

  const signOut = useCallback(async (message?: string) => {
    await SecureStore.deleteItemAsync(MOBILE_SESSION_TOKEN_KEY);
    setSession(null);
    setBusinessProfile(null);
    setHome(null);
    setReferrals(null);
    setFunds(null);
    setActiveTab('home');
    setAuthMode('sign-in');
    setAuthError(null);
    setAuthNotice(null);
    setBusinessProfileError(null);
    setHomeError(null);
    setReferralsError(null);
    setFundsError(null);
    setPendingVerification(null);
    if (message) {
      setAuthError(message);
    }
  }, []);

  const handleSessionError = useCallback(
    async (error: unknown, fallback: string, setError: (message: string | null) => void) => {
      if (error instanceof ClientificApiError && error.status === 401) {
        await signOut('Your mobile session expired. Sign in again.');
        return;
      }

      setError(getReadableError(error, fallback));
    },
    [signOut],
  );

  const loadHome = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingHome(true);
      } else {
        setIsLoadingHome(true);
      }

      try {
        const nextHome = await fetchMobileHomeSummary(token);
        setHome(nextHome);
        setSession({ token, business: nextHome.business });
        if (nextHome.business.onboardingComplete) {
          setBusinessProfile(null);
          setBusinessProfileError(null);
        }
        setHomeError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load your mobile home.', setHomeError);
      } finally {
        if (isRefresh) {
          setIsRefreshingHome(false);
        } else {
          setIsLoadingHome(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadBusinessProfile = useCallback(
    async (token: string) => {
      setIsLoadingBusinessProfile(true);

      try {
        const response = await fetchMobileBusinessProfile(token);
        setBusinessProfile(response.business);
        setBusinessProfileError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load your business setup.',
          setBusinessProfileError,
        );
      } finally {
        setIsLoadingBusinessProfile(false);
      }
    },
    [handleSessionError],
  );

  const loadReferrals = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingReferrals(true);
      } else {
        setIsLoadingReferrals(true);
      }

      try {
        const nextReferrals = await fetchMobileReferrals(token);
        setReferrals(nextReferrals);
        setReferralsError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load referrals.', setReferralsError);
      } finally {
        if (isRefresh) {
          setIsRefreshingReferrals(false);
        } else {
          setIsLoadingReferrals(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadFunds = useCallback(
    async (token: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingFunds(true);
      } else {
        setIsLoadingFunds(true);
      }

      try {
        const nextFunds = await fetchMobileFunds(token);
        setFunds(nextFunds);
        setFundsError(null);
      } catch (error) {
        await handleSessionError(error, 'Unable to load funds.', setFundsError);
      } finally {
        if (isRefresh) {
          setIsRefreshingFunds(false);
        } else {
          setIsLoadingFunds(false);
        }
      }
    },
    [handleSessionError],
  );

  const openFundsTab = useCallback(() => {
    setActiveTab('funds');
    if (session && !funds && !isLoadingFunds) {
      void loadFunds(session.token);
    }
  }, [funds, isLoadingFunds, loadFunds, session]);

  const openReferralsTab = useCallback(() => {
    setActiveTab('referrals');
    if (session && !referrals && !isLoadingReferrals) {
      void loadReferrals(session.token);
    }
  }, [isLoadingReferrals, loadReferrals, referrals, session]);

  const shareReferral = useCallback(async () => {
    if (!referrals?.payoutReady || !referrals.referralCode) {
      return;
    }

    try {
      const referralUrl = `${getClientificWebUrl()}/register?ref=${referrals.referralCode}`;
      await Share.share({
        message: `${session?.business.name ?? 'Clientific'} invited you to join Clientific. Start here: ${referralUrl}`,
      });
      setReferralsError(null);
    } catch (error) {
      setReferralsError(getReadableError(error, 'Unable to open the share sheet.'));
    }
  }, [referrals, session?.business.name]);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const token = await SecureStore.getItemAsync(MOBILE_SESSION_TOKEN_KEY);
        if (!token) {
          return;
        }

        const nextHome = await fetchMobileHomeSummary(token);
        if (!isActive) {
          return;
        }

        setHome(nextHome);
        setSession({ token, business: nextHome.business });
        setAuthMode('sign-in');
        setAuthNotice(null);
      } catch (error) {
        const isExpiredSession =
          error instanceof ClientificApiError && error.status === 401;

        if (isExpiredSession) {
          await SecureStore.deleteItemAsync(MOBILE_SESSION_TOKEN_KEY);
        } else if (isActive) {
          setAuthError(getReadableError(error, 'Unable to reopen your mobile session.'));
        }
      } finally {
        if (isActive) {
          setIsBooting(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  const establishSession = useCallback(
    async (email: string, password: string) => {
      const nextSession = await loginWithClientific({ email, password });
      await SecureStore.setItemAsync(MOBILE_SESSION_TOKEN_KEY, nextSession.token);
      setSession(nextSession);
      setAuthMode('sign-in');
      setPendingVerification(null);
      setAuthNotice(null);
      setActiveTab('home');
      await loadHome(nextSession.token);
    },
    [loadHome],
  );

  const handleLogin = useCallback(async (email: string, password: string) => {
    setIsSubmittingAuth(true);
    setAuthError(null);
    setAuthNotice(null);
    setBusinessProfileError(null);
    setHomeError(null);
    setReferralsError(null);
    setFundsError(null);

    try {
      await establishSession(email.trim(), password);
    } catch (error) {
      if (
        error instanceof ClientificApiError &&
        error.status === 403 &&
        error.message === 'EmailNotVerified'
      ) {
        setPendingVerification({
          email: email.trim().toLowerCase(),
          password,
        });
        setAuthMode('verify');
        setAuthError('Enter the 6-digit code from your email to finish signing in.');
      } else {
        setAuthError(getReadableError(error, 'Unable to sign in right now.'));
      }
    } finally {
      setIsSubmittingAuth(false);
      setIsBooting(false);
    }
  }, [establishSession]);

  const handleRegister = useCallback(async (input: MobileRegistrationForm) => {
    const trimmedEmail = input.email.trim().toLowerCase();
    const trimmedBusinessName = input.businessName.trim();

    if (!trimmedBusinessName) {
      setAuthError('Business name is required.');
      return;
    }

    if (!trimmedEmail) {
      setAuthError('Email is required.');
      return;
    }

    if (input.password.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }

    if (!/[0-9]/.test(input.password)) {
      setAuthError('Password must include a number.');
      return;
    }

    if (!/[!@#$%^&*]/.test(input.password)) {
      setAuthError('Password must include a special character.');
      return;
    }

    if (input.password !== input.confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    if (!input.acceptTerms) {
      setAuthError('You need to accept the terms to continue.');
      return;
    }

    setIsSubmittingAuth(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      const response = await registerWithClientific({
        businessName: trimmedBusinessName,
        businessType: input.businessType,
        email: trimmedEmail,
        password: input.password,
        referralCode: input.referralCode.trim() || undefined,
      });

      setPendingVerification({
        email: trimmedEmail,
        password: input.password,
      });
      setAuthMode('verify');
      setAuthNotice(
        response.verificationEmailSent
          ? 'Account created. Check your email for the verification code.'
          : 'Account created. Use resend below if the verification code did not arrive.',
      );
    } catch (error) {
      setAuthError(getReadableError(error, 'Unable to create your account right now.'));
    } finally {
      setIsSubmittingAuth(false);
    }
  }, []);

  const handleVerifyCode = useCallback(
    async (email: string, code: string) => {
      const trimmedCode = code.replace(/\D/g, '');
      const verifiedEmail = email.trim().toLowerCase();

      if (trimmedCode.length !== 6) {
        setAuthError('Enter the 6-digit verification code.');
        return;
      }

      setIsSubmittingAuth(true);
      setAuthError(null);
      setAuthNotice(null);

      try {
        await confirmVerificationCode({ email: verifiedEmail, code: trimmedCode });

        if (!pendingVerification?.password || pendingVerification.email !== verifiedEmail) {
          setAuthMode('sign-in');
          setAuthNotice('Email verified. Sign in to continue.');
          return;
        }

        await establishSession(verifiedEmail, pendingVerification.password);
      } catch (error) {
        setAuthError(getReadableError(error, 'Unable to verify your email right now.'));
      } finally {
        setIsSubmittingAuth(false);
      }
    },
    [establishSession, pendingVerification],
  );

  const handleResendCode = useCallback(async (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setAuthError('Add your email address first.');
      return;
    }

    setIsResendingCode(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      await resendVerificationCode(trimmedEmail);
      setAuthNotice('If your account is waiting for verification, a new code is on the way.');
    } catch (error) {
      setAuthError(getReadableError(error, 'Unable to resend the verification code.'));
    } finally {
      setIsResendingCode(false);
    }
  }, []);

  const handleSaveBusinessProfile = useCallback(
    async (input: MobileOnboardingInput) => {
      if (!session) {
        return;
      }

      setIsSavingBusinessProfile(true);
      setBusinessProfileError(null);

      try {
        const response = await updateMobileBusinessProfile(session.token, input);
        setBusinessProfile(response.business);
        await loadHome(session.token);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to save your business setup.',
          setBusinessProfileError,
        );
      } finally {
        setIsSavingBusinessProfile(false);
      }
    },
    [handleSessionError, loadHome, session],
  );

  const handleRefreshHome = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadHome(session.token, true);
  }, [loadHome, session]);

  const handleRefreshReferrals = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadReferrals(session.token, true);
  }, [loadReferrals, session]);

  const handleRefreshFunds = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadFunds(session.token, true);
  }, [loadFunds, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (home && !home.business.onboardingComplete && !businessProfile && !isLoadingBusinessProfile) {
      void loadBusinessProfile(session.token);
    }

    if (activeTab === 'referrals' && !referrals && !isLoadingReferrals) {
      void loadReferrals(session.token);
    }

    if (activeTab === 'funds' && !funds && !isLoadingFunds) {
      void loadFunds(session.token);
    }
  }, [
    activeTab,
    funds,
    businessProfile,
    home,
    isLoadingFunds,
    isLoadingBusinessProfile,
    isLoadingReferrals,
    loadBusinessProfile,
    loadFunds,
    loadReferrals,
    referrals,
    session,
  ]);

  if (isBooting || (session && !home && isLoadingHome)) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.loadingTitle, { color: theme.text }]}>Opening your account</Text>
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            Checking your sign-in and loading the mobile workspace.
          </Text>
        </View>
      </View>
    );
  }

  if (session && !home) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.loadingTitle, { color: theme.text }]}>Couldn&apos;t open the app</Text>
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            {homeError ?? 'Please try loading the business app again.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadHome(session.token)}
            style={[styles.retryButton, { backgroundColor: theme.accent }]}
            testID="mobile-home-retry">
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={[styles.signOutButton, { borderColor: theme.border }]}
            testID="mobile-home-signout-fallback">
            <Text style={[styles.signOutButtonText, { color: theme.text }]}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!session || !home) {
    return (
      <MobileAuthScreen
        error={authError}
        isResendingCode={isResendingCode}
        isSubmitting={isSubmittingAuth}
        mode={authMode}
        notice={authNotice}
        verificationEmail={pendingVerification?.email ?? ''}
        onBackToSignIn={() => {
          setAuthMode('sign-in');
          setAuthError(null);
          setAuthNotice(null);
        }}
        onLogin={handleLogin}
        onModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError(null);
          setAuthNotice(null);
        }}
        onRegister={handleRegister}
        onResendCode={handleResendCode}
        onVerify={handleVerifyCode}
      />
    );
  }

  if (!home.business.onboardingComplete) {
    if (isLoadingBusinessProfile || !businessProfile) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[styles.loadingTitle, { color: theme.text }]}>Loading setup</Text>
            <Text style={[styles.loadingText, { color: theme.mutedText }]}>
              Pulling in the business details you still need to finish.
            </Text>
            {businessProfileError ? (
              <>
                <Text style={[styles.loadingText, { color: theme.mutedText }]}>
                  {businessProfileError}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadBusinessProfile(session.token)}
                  style={[styles.retryButton, { backgroundColor: theme.accent }]}
                  testID="mobile-onboarding-retry">
                  <Text style={styles.retryButtonText}>Try again</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <MobileOnboardingScreen
        error={businessProfileError}
        isSaving={isSavingBusinessProfile}
        profile={businessProfile}
        onSignOut={signOut}
        onSubmit={handleSaveBusinessProfile}
      />
    );
  }

  return (
    <MobileAppShell
      activeTab={activeTab}
      business={home.business}
      funds={funds}
      fundsError={fundsError}
      home={home}
      homeError={homeError}
      isFundsLoading={isLoadingFunds}
      isFundsRefreshing={isRefreshingFunds}
      isHomeRefreshing={isRefreshingHome}
      isReferralsLoading={isLoadingReferrals}
      isReferralsRefreshing={isRefreshingReferrals}
      onChangeTab={setActiveTab}
      onOpenFunds={openFundsTab}
      onOpenReferrals={openReferralsTab}
      onRefreshFunds={handleRefreshFunds}
      onRefreshHome={handleRefreshHome}
      onRefreshReferrals={handleRefreshReferrals}
      onShareReferral={shareReferral}
      onSignOut={signOut}
      referrals={referrals}
      referralsError={referralsError}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  loadingTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    width: '100%',
  },
  retryButtonText: {
    color: '#f8fffc',
    fontSize: 15,
    fontWeight: '800',
  },
  signOutButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    width: '100%',
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
