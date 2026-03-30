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
  fetchMobileFunds,
  fetchMobileHomeSummary,
  fetchMobileReferrals,
  getClientificWebUrl,
  MobileFundsSummary,
  MobileHomeSummary,
  MobileLoginResponse,
  MobileReferralsSummary,
  loginWithClientific,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileAppShell, type MobileAppTab } from '@/components/mobile-app-shell';
import { MobileLoginScreen } from '@/components/mobile-login-screen';

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
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [isRefreshingHome, setIsRefreshingHome] = useState(false);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [isRefreshingReferrals, setIsRefreshingReferrals] = useState(false);
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);
  const [isRefreshingFunds, setIsRefreshingFunds] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [referralsError, setReferralsError] = useState<string | null>(null);
  const [fundsError, setFundsError] = useState<string | null>(null);
  const [session, setSession] = useState<MobileLoginResponse | null>(null);
  const [home, setHome] = useState<MobileHomeSummary | null>(null);
  const [referrals, setReferrals] = useState<MobileReferralsSummary | null>(null);
  const [funds, setFunds] = useState<MobileFundsSummary | null>(null);

  const signOut = useCallback(async (message?: string) => {
    await SecureStore.deleteItemAsync(MOBILE_SESSION_TOKEN_KEY);
    setSession(null);
    setHome(null);
    setReferrals(null);
    setFunds(null);
    setActiveTab('home');
    setAuthError(null);
    setHomeError(null);
    setReferralsError(null);
    setFundsError(null);
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

  const handleLogin = useCallback(async (email: string, password: string) => {
    setIsSigningIn(true);
    setAuthError(null);
    setHomeError(null);
    setReferralsError(null);
    setFundsError(null);

    try {
      const nextSession = await loginWithClientific({ email, password });
      await SecureStore.setItemAsync(MOBILE_SESSION_TOKEN_KEY, nextSession.token);
      setSession(nextSession);
      setActiveTab('home');
      await loadHome(nextSession.token);
    } catch (error) {
      setAuthError(getReadableError(error, 'Unable to sign in right now.'));
    } finally {
      setIsSigningIn(false);
      setIsBooting(false);
    }
  }, [loadHome]);

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

    if (activeTab === 'referrals' && !referrals && !isLoadingReferrals) {
      void loadReferrals(session.token);
    }

    if (activeTab === 'funds' && !funds && !isLoadingFunds) {
      void loadFunds(session.token);
    }
  }, [
    activeTab,
    funds,
    isLoadingFunds,
    isLoadingReferrals,
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
          <Text style={[styles.loadingTitle, { color: theme.text }]}>Opening Clientific</Text>
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            Checking your sign-in and loading the business app.
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
      <MobileLoginScreen
        error={authError}
        isLoading={isSigningIn}
        onSubmit={handleLogin}
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
