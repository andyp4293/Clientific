import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import {
  ClientificApiError,
  fetchMobileDashboardSummary,
  MobileDashboardSummary,
  MobileLoginResponse,
  loginWithClientific,
} from '@/lib/clientific-api';
import { getClientificTheme } from '@/lib/clientific-mobile-theme';
import { MobileLoginScreen } from '@/components/mobile-login-screen';
import { MobileDashboardScreen } from '@/components/mobile-dashboard-screen';

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
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [isBooting, setIsBooting] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [session, setSession] = useState<MobileLoginResponse | null>(null);
  const [summary, setSummary] = useState<MobileDashboardSummary | null>(null);

  const openWorkspace = useCallback(() => {
    router.push('/workspace');
  }, [router]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(MOBILE_SESSION_TOKEN_KEY);
    setSession(null);
    setSummary(null);
    setAuthError(null);
    setDashboardError(null);
  }, []);

  const hydrateDashboard = useCallback(async (token: string) => {
    const nextSummary = await fetchMobileDashboardSummary(token);
    setSummary(nextSummary);
    setSession({ token, business: nextSummary.business });
    setDashboardError(null);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      try {
        const token = await SecureStore.getItemAsync(MOBILE_SESSION_TOKEN_KEY);
        if (!token) {
          return;
        }

        const nextSummary = await fetchMobileDashboardSummary(token);
        if (!isActive) {
          return;
        }

        setSummary(nextSummary);
        setSession({ token, business: nextSummary.business });
      } catch {
        await SecureStore.deleteItemAsync(MOBILE_SESSION_TOKEN_KEY);
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
    setDashboardError(null);

    try {
      const nextSession = await loginWithClientific({ email, password });
      await SecureStore.setItemAsync(MOBILE_SESSION_TOKEN_KEY, nextSession.token);
      setSession(nextSession);
      await hydrateDashboard(nextSession.token);
    } catch (error) {
      setAuthError(getReadableError(error, 'Unable to sign in right now.'));
    } finally {
      setIsSigningIn(false);
      setIsBooting(false);
    }
  }, [hydrateDashboard]);

  const handleRefresh = useCallback(async () => {
    if (!session) {
      return;
    }

    setIsRefreshing(true);
    setDashboardError(null);

    try {
      await hydrateDashboard(session.token);
    } catch (error) {
      if (error instanceof ClientificApiError && error.status === 401) {
        await signOut();
        setAuthError('Your mobile session expired. Sign in again.');
      } else {
        setDashboardError(getReadableError(error, 'Unable to refresh the dashboard yet.'));
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [hydrateDashboard, session, signOut]);

  if (isBooting) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.loadingTitle, { color: theme.text }]}>Opening Clientific</Text>
          <Text style={[styles.loadingText, { color: theme.mutedText }]}>
            Checking your native session and loading the first mobile dashboard slice.
          </Text>
        </View>
      </View>
    );
  }

  if (!session || !summary) {
    return (
      <MobileLoginScreen
        error={authError}
        isLoading={isSigningIn}
        onSubmit={handleLogin}
        onOpenWorkspace={openWorkspace}
      />
    );
  }

  return (
    <MobileDashboardScreen
      error={dashboardError}
      isRefreshing={isRefreshing}
      summary={summary}
      onOpenWorkspace={openWorkspace}
      onRefresh={handleRefresh}
      onSignOut={signOut}
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
});
