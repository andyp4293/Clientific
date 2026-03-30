import Constants from 'expo-constants';

const configuredWebUrl =
  process.env.EXPO_PUBLIC_CLIENTIFIC_WEB_URL ??
  (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ??
  'https://www.clientific.app';

const API_BASE_URL = configuredWebUrl.replace(/\/$/, '');

export type MobileBusiness = {
  id: string;
  email: string;
  name: string;
  businessType?: string | null;
  onboardingComplete: boolean;
};

export type MobileBusinessProfile = MobileBusiness & {
  ownerPhone: string | null;
  phone: string | null;
  businessEmail: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  timezone: string | null;
};

export type MobileHomeMetric = {
  label: string;
  value: string;
  helper: string;
};

export type MobileTodayAppointment = {
  id: string;
  customerName: string;
  serviceName: string;
  status: string;
  startTimeLabel: string;
};

export type MobileHomeSummary = {
  business: MobileBusiness;
  metrics: MobileHomeMetric[];
  todayAppointments: MobileTodayAppointment[];
  referralSnapshot: {
    activeCount: number;
    pendingCount: number;
    lifetimeCredits: number;
    payoutReady: boolean;
    setupMessage: string | null;
  };
  trialDaysRemaining: number | null;
};

export type MobileReferralEntry = {
  id: string;
  refereeName: string;
  startedAtLabel: string;
  statusLabel: string;
  creditAmountLabel: string;
};

export type MobileReferralsSummary = {
  business: MobileBusiness;
  referralCode: string | null;
  payoutReady: boolean;
  payoutSetupMessage: string | null;
  totalCredits: number;
  activeCount: number;
  pendingCount: number;
  referrals: MobileReferralEntry[];
};

export type MobileFundsPayout = {
  id: string;
  amountLabel: string;
  arrivalDateLabel: string;
  destinationLabel: string;
  statusLabel: string;
};

export type MobileFundsSummary = {
  business: MobileBusiness;
  notConnected: boolean;
  payoutReady: boolean;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  availableBalanceLabel: string;
  pendingBalanceLabel: string;
  dealPendingTransferLabel: string;
  referralPendingTransferLabel: string;
  dealTransferredLabel: string;
  referralTransferredLabel: string;
  bankAccountSummary: string | null;
  payoutScheduleSummary: string;
  setupMessage: string | null;
  requirementTasks: string[];
  recentPayouts: MobileFundsPayout[];
};

export type MobileLoginResponse = {
  token: string;
  business: MobileBusiness;
};

export type MobileRegistrationInput = {
  email: string;
  password: string;
  businessName: string;
  businessType: string;
  referralCode?: string;
};

export type MobileRegistrationResponse = {
  success: true;
  requiresEmailVerification: boolean;
  verificationEmailSent: boolean;
  business: {
    id: string;
    email: string;
    name: string;
    slug: string;
  };
};

export type MobileOnboardingInput = {
  ownerPhone?: string | null;
  phone: string;
  businessEmail?: string | null;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  timezone: string;
};

export class ClientificApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ClientificApiError';
  }
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ClientificApiError(
      typeof data?.error === 'string' ? data.error : 'Request failed',
      response.status,
    );
  }

  return data as T;
}

export async function loginWithClientific(input: {
  email: string;
  password: string;
}) {
  return requestJson<MobileLoginResponse>('/api/mobile/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function registerWithClientific(input: MobileRegistrationInput) {
  return requestJson<MobileRegistrationResponse>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function resendVerificationCode(email: string) {
  return requestJson<{ success: true }>('/api/auth/verify-email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function confirmVerificationCode(input: {
  email: string;
  code: string;
}) {
  return requestJson<{ success: true; email: string }>('/api/auth/verify-email/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function fetchMobileHomeSummary(token: string) {
  return requestJson<MobileHomeSummary>('/api/mobile/dashboard/summary', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileReferrals(token: string) {
  return requestJson<MobileReferralsSummary>('/api/mobile/referrals', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileFunds(token: string) {
  return requestJson<MobileFundsSummary>('/api/mobile/funds', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileBusinessProfile(token: string) {
  return requestJson<{ business: MobileBusinessProfile }>('/api/mobile/business', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function updateMobileBusinessProfile(
  token: string,
  input: MobileOnboardingInput,
) {
  return requestJson<{ business: MobileBusinessProfile }>('/api/mobile/business', {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export function getClientificWebUrl() {
  return API_BASE_URL;
}
