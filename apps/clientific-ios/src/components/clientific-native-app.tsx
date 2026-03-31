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
  createMobileCheckIn,
  ClientificApiError,
  confirmVerificationCode,
  fetchMobileAppointments,
  fetchMobileBusinessProfile,
  fetchMobileCheckIns,
  fetchMobileCustomers,
  fetchMobileFunds,
  fetchMobileHomeSummary,
  fetchMobileReferrals,
  getClientificWebUrl,
  lookupMobileCheckIn,
  MobileAppointmentsSummary,
  MobileBusinessProfile,
  MobileCheckInSubmissionInput,
  MobileCheckInsSummary,
  MobileCustomersSummary,
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
import {
  MobileAppShell,
  type MobileAppTab,
} from '@/components/mobile-app-shell';
import {
  MobileAuthScreen,
  type MobileAuthMode,
  type MobileRegistrationForm,
} from '@/components/mobile-auth-screen';
import type { MobileMoreSection } from '@/components/mobile-more-screen';
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

function formatMobileDateKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

function shiftMobileDateKey(dateKey: string, direction: -1 | 1) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const nextDate = new Date(year, (month || 1) - 1, day || 1);
  nextDate.setDate(nextDate.getDate() + direction);
  return formatMobileDateKey(nextDate);
}

export function ClientificNativeApp() {
  const colorScheme = useColorScheme();
  const theme = getClientificTheme(colorScheme);
  const [isBooting, setIsBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<MobileAppTab>('home');
  const [moreSection, setMoreSection] = useState<MobileMoreSection>('referrals');
  const [authMode, setAuthMode] = useState<MobileAuthMode>('sign-in');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [isLoadingHome, setIsLoadingHome] = useState(false);
  const [isRefreshingHome, setIsRefreshingHome] = useState(false);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [isRefreshingAppointments, setIsRefreshingAppointments] = useState(false);
  const [isLoadingCheckIns, setIsLoadingCheckIns] = useState(false);
  const [isRefreshingCheckIns, setIsRefreshingCheckIns] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isRefreshingCustomers, setIsRefreshingCustomers] = useState(false);
  const [isLoadingBusinessProfile, setIsLoadingBusinessProfile] = useState(false);
  const [isSavingBusinessProfile, setIsSavingBusinessProfile] = useState(false);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [isRefreshingReferrals, setIsRefreshingReferrals] = useState(false);
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);
  const [isRefreshingFunds, setIsRefreshingFunds] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [businessProfileError, setBusinessProfileError] = useState<string | null>(null);
  const [checkInsError, setCheckInsError] = useState<string | null>(null);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [referralsError, setReferralsError] = useState<string | null>(null);
  const [fundsError, setFundsError] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [appointmentsDate, setAppointmentsDate] = useState(() => formatMobileDateKey(new Date()));
  const [checkInsDate, setCheckInsDate] = useState(() => formatMobileDateKey(new Date()));
  const [customersPage, setCustomersPage] = useState(1);
  const [customersSearchDraft, setCustomersSearchDraft] = useState('');
  const [customersSearchQuery, setCustomersSearchQuery] = useState('');
  const [session, setSession] = useState<MobileLoginResponse | null>(null);
  const [appointments, setAppointments] = useState<MobileAppointmentsSummary | null>(null);
  const [businessProfile, setBusinessProfile] = useState<MobileBusinessProfile | null>(null);
  const [checkIns, setCheckIns] = useState<MobileCheckInsSummary | null>(null);
  const [customers, setCustomers] = useState<MobileCustomersSummary | null>(null);
  const [home, setHome] = useState<MobileHomeSummary | null>(null);
  const [referrals, setReferrals] = useState<MobileReferralsSummary | null>(null);
  const [funds, setFunds] = useState<MobileFundsSummary | null>(null);

  const signOut = useCallback(async (message?: string) => {
    await SecureStore.deleteItemAsync(MOBILE_SESSION_TOKEN_KEY);
    setSession(null);
    setAppointments(null);
    setBusinessProfile(null);
    setCheckIns(null);
    setCustomers(null);
    setHome(null);
    setReferrals(null);
    setFunds(null);
    setActiveTab('home');
    setMoreSection('referrals');
    setAuthMode('sign-in');
    setAuthError(null);
    setAuthNotice(null);
    setAppointmentsError(null);
    setBusinessProfileError(null);
    setCheckInsError(null);
    setCustomersError(null);
    setHomeError(null);
    setReferralsError(null);
    setFundsError(null);
    setAppointmentsDate(formatMobileDateKey(new Date()));
    setCheckInsDate(formatMobileDateKey(new Date()));
    setCustomersPage(1);
    setCustomersSearchDraft('');
    setCustomersSearchQuery('');
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

  const loadAppointments = useCallback(
    async (token: string, date: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingAppointments(true);
      } else {
        setIsLoadingAppointments(true);
      }

      try {
        const nextAppointments = await fetchMobileAppointments(token, { date });
        setAppointments(nextAppointments);
        setAppointmentsError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load your mobile schedule.',
          setAppointmentsError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingAppointments(false);
        } else {
          setIsLoadingAppointments(false);
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

  const loadCheckIns = useCallback(
    async (token: string, date: string, isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingCheckIns(true);
      } else {
        setIsLoadingCheckIns(true);
      }

      try {
        const nextCheckIns = await fetchMobileCheckIns(token, { date });
        setCheckIns(nextCheckIns);
        setCheckInsError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load mobile check-ins.',
          setCheckInsError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingCheckIns(false);
        } else {
          setIsLoadingCheckIns(false);
        }
      }
    },
    [handleSessionError],
  );

  const loadCustomers = useCallback(
    async (
      token: string,
      options: { page: number; search: string },
      isRefresh = false,
    ) => {
      if (isRefresh) {
        setIsRefreshingCustomers(true);
      } else {
        setIsLoadingCustomers(true);
      }

      try {
        const nextCustomers = await fetchMobileCustomers(token, {
          page: options.page,
          pageSize: 20,
          search: options.search,
        });
        setCustomers(nextCustomers);
        setCustomersError(null);
      } catch (error) {
        await handleSessionError(
          error,
          'Unable to load mobile customers.',
          setCustomersError,
        );
      } finally {
        if (isRefresh) {
          setIsRefreshingCustomers(false);
        } else {
          setIsLoadingCustomers(false);
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
    setMoreSection('funds');
    setActiveTab('more');
    if (session && !funds && !isLoadingFunds) {
      void loadFunds(session.token);
    }
  }, [funds, isLoadingFunds, loadFunds, session]);

  const openReferralsTab = useCallback(() => {
    setMoreSection('referrals');
    setActiveTab('more');
    if (session && !referrals && !isLoadingReferrals) {
      void loadReferrals(session.token);
    }
  }, [isLoadingReferrals, loadReferrals, referrals, session]);

  const openScheduleTab = useCallback(() => {
    setActiveTab('schedule');
    if (
      session &&
      (!appointments || appointments.selectedDate !== appointmentsDate) &&
      !isLoadingAppointments
    ) {
      void loadAppointments(session.token, appointmentsDate);
    }
  }, [
    appointments,
    appointmentsDate,
    isLoadingAppointments,
    loadAppointments,
    session,
  ]);

  const openCheckInsTab = useCallback(() => {
    setActiveTab('checkins');
    if (session && (!checkIns || checkIns.selectedDate !== checkInsDate) && !isLoadingCheckIns) {
      void loadCheckIns(session.token, checkInsDate);
    }
  }, [checkIns, checkInsDate, isLoadingCheckIns, loadCheckIns, session]);

  const openCustomersTab = useCallback(() => {
    setActiveTab('customers');
    if (
      session &&
      (!customers ||
        customers.currentPage !== customersPage ||
        customers.search !== customersSearchQuery) &&
      !isLoadingCustomers
    ) {
      void loadCustomers(
        session.token,
        {
          page: customersPage,
          search: customersSearchQuery,
        },
      );
    }
  }, [
    customers,
    customersPage,
    customersSearchQuery,
    isLoadingCustomers,
    loadCustomers,
    session,
  ]);

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
    setAppointmentsError(null);
    setBusinessProfileError(null);
    setCheckInsError(null);
    setCustomersError(null);
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

  const handleRefreshAppointments = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadAppointments(session.token, appointmentsDate, true);
  }, [appointmentsDate, loadAppointments, session]);

  const handleRefreshCheckIns = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadCheckIns(session.token, checkInsDate, true);
  }, [checkInsDate, loadCheckIns, session]);

  const handleRefreshCustomers = useCallback(async () => {
    if (!session) {
      return;
    }

    await loadCustomers(
      session.token,
      {
        page: customersPage,
        search: customersSearchQuery,
      },
      true,
    );
  }, [customersPage, customersSearchQuery, loadCustomers, session]);

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

  const goToPreviousAppointmentsDate = useCallback(() => {
    setAppointmentsDate((currentValue) => shiftMobileDateKey(currentValue, -1));
  }, []);

  const goToNextAppointmentsDate = useCallback(() => {
    setAppointmentsDate((currentValue) => shiftMobileDateKey(currentValue, 1));
  }, []);

  const jumpAppointmentsToToday = useCallback(() => {
    setAppointmentsDate(formatMobileDateKey(new Date()));
  }, []);

  const goToPreviousCheckInsDate = useCallback(() => {
    setCheckInsDate((currentValue) => shiftMobileDateKey(currentValue, -1));
  }, []);

  const goToNextCheckInsDate = useCallback(() => {
    setCheckInsDate((currentValue) => shiftMobileDateKey(currentValue, 1));
  }, []);

  const jumpCheckInsToToday = useCallback(() => {
    setCheckInsDate(formatMobileDateKey(new Date()));
  }, []);

  const goToPreviousCustomersPage = useCallback(() => {
    setCustomersPage((currentPage) => Math.max(1, currentPage - 1));
  }, []);

  const goToNextCustomersPage = useCallback(() => {
    setCustomersPage((currentPage) => {
      const totalPages = customers?.totalPages ?? currentPage + 1;
      return currentPage < totalPages ? currentPage + 1 : currentPage;
    });
  }, [customers?.totalPages]);

  const handleLookupCheckIn = useCallback(
    async (phone: string) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        return await lookupMobileCheckIn(session.token, phone);
      } catch (error) {
        await handleSessionError(error, 'Unable to find customer.', setCheckInsError);
        throw new Error(getReadableError(error, 'Unable to find customer.'));
      }
    },
    [handleSessionError, session],
  );

  const handleCreateCheckIn = useCallback(
    async (input: MobileCheckInSubmissionInput) => {
      if (!session) {
        throw new Error('Sign in again to continue.');
      }

      try {
        const response = await createMobileCheckIn(session.token, input);
        await Promise.all([
          loadCheckIns(session.token, checkInsDate),
          loadHome(session.token),
          customers
            ? loadCustomers(session.token, {
                page: customersPage,
                search: customersSearchQuery,
              })
            : Promise.resolve(),
        ]);
        return response;
      } catch (error) {
        await handleSessionError(error, 'Unable to complete check-in.', setCheckInsError);
        throw new Error(getReadableError(error, 'Unable to complete check-in.'));
      }
    },
    [
      checkInsDate,
      customers,
      customersPage,
      customersSearchQuery,
      handleSessionError,
      loadCheckIns,
      loadCustomers,
      loadHome,
      session,
    ],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCustomersPage(1);
      setCustomersSearchQuery(customersSearchDraft.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [customersSearchDraft]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (home && !home.business.onboardingComplete && !businessProfile && !isLoadingBusinessProfile) {
      void loadBusinessProfile(session.token);
    }

    if (
      activeTab === 'schedule' &&
      (!appointments || appointments.selectedDate !== appointmentsDate) &&
      !isLoadingAppointments
    ) {
      void loadAppointments(session.token, appointmentsDate);
    }

    if (
      activeTab === 'checkins' &&
      (!checkIns || checkIns.selectedDate !== checkInsDate) &&
      !isLoadingCheckIns
    ) {
      void loadCheckIns(session.token, checkInsDate);
    }

    if (
      activeTab === 'customers' &&
      (!customers ||
        customers.currentPage !== customersPage ||
        customers.search !== customersSearchQuery) &&
      !isLoadingCustomers
    ) {
      void loadCustomers(session.token, {
        page: customersPage,
        search: customersSearchQuery,
      });
    }

    if (activeTab === 'more' && moreSection === 'referrals' && !referrals && !isLoadingReferrals) {
      void loadReferrals(session.token);
    }

    if (activeTab === 'more' && moreSection === 'funds' && !funds && !isLoadingFunds) {
      void loadFunds(session.token);
    }
  }, [
    activeTab,
    appointments,
    appointmentsDate,
    businessProfile,
    checkIns,
    checkInsDate,
    customers,
    customersPage,
    customersSearchQuery,
    funds,
    home,
    isLoadingAppointments,
    isLoadingBusinessProfile,
    isLoadingCheckIns,
    isLoadingCustomers,
    isLoadingFunds,
    isLoadingReferrals,
    loadAppointments,
    loadBusinessProfile,
    loadCheckIns,
    loadCustomers,
    loadFunds,
    loadReferrals,
    moreSection,
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
      appointments={appointments}
      appointmentsError={appointmentsError}
      business={home.business}
      checkIns={checkIns}
      checkInsError={checkInsError}
      customers={customers}
      customersError={customersError}
      customersSearchDraft={customersSearchDraft}
      funds={funds}
      fundsError={fundsError}
      home={home}
      homeError={homeError}
      isAppointmentsLoading={isLoadingAppointments}
      isAppointmentsRefreshing={isRefreshingAppointments}
      isCheckInsLoading={isLoadingCheckIns}
      isCheckInsRefreshing={isRefreshingCheckIns}
      isCustomersLoading={isLoadingCustomers}
      isCustomersRefreshing={isRefreshingCustomers}
      isFundsLoading={isLoadingFunds}
      isFundsRefreshing={isRefreshingFunds}
      isHomeRefreshing={isRefreshingHome}
      isReferralsLoading={isLoadingReferrals}
      isReferralsRefreshing={isRefreshingReferrals}
      moreSection={moreSection}
      onChangeCustomersSearchDraft={setCustomersSearchDraft}
      onChangeMoreSection={setMoreSection}
      onChangeTab={setActiveTab}
      onCreateCheckIn={handleCreateCheckIn}
      onJumpAppointmentsToToday={jumpAppointmentsToToday}
      onJumpCheckInsToToday={jumpCheckInsToToday}
      onLookupCheckIn={handleLookupCheckIn}
      onNextAppointmentsDate={goToNextAppointmentsDate}
      onNextCheckInsDate={goToNextCheckInsDate}
      onNextCustomersPage={goToNextCustomersPage}
      onOpenCheckIns={openCheckInsTab}
      onOpenCustomers={openCustomersTab}
      onOpenFunds={openFundsTab}
      onOpenReferrals={openReferralsTab}
      onOpenSchedule={openScheduleTab}
      onPreviousAppointmentsDate={goToPreviousAppointmentsDate}
      onPreviousCheckInsDate={goToPreviousCheckInsDate}
      onPreviousCustomersPage={goToPreviousCustomersPage}
      onRefreshAppointments={handleRefreshAppointments}
      onRefreshCheckIns={handleRefreshCheckIns}
      onRefreshCustomers={handleRefreshCustomers}
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
