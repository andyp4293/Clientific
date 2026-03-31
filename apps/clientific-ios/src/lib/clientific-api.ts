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

export type MobileAppointmentEntry = {
  id: string;
  customerName: string;
  serviceName: string;
  staffName: string | null;
  status: string;
  statusLabel: string;
  startTimeLabel: string;
  endTimeLabel: string;
  sourceLabel: string;
  notes: string | null;
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

export type MobileAppointmentsSummary = {
  business: MobileBusiness;
  selectedDate: string;
  dateLabel: string;
  timezone: string;
  counts: {
    total: number;
    pending: number;
    confirmed: number;
    scheduled: number;
  };
  appointments: MobileAppointmentEntry[];
};

export type MobileDealRecord = {
  id: string;
  title: string;
  description: string | null;
  discountLabel: string;
  statusLabel: string;
  statusTone: 'live' | 'scheduled' | 'ended' | 'draft';
  windowLabel: string;
  deliveryLabel: string;
  purchasesCount: number;
  redemptionsCount: number;
  revenueLabel: string;
  linkPath: string;
};

export type MobileDealsSummary = {
  business: MobileBusiness;
  payoutReady: boolean;
  payoutSetupMessage: string | null;
  counts: {
    total: number;
    live: number;
    scheduled: number;
    ended: number;
  };
  deals: MobileDealRecord[];
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

export type MobileCheckInRecord = {
  id: string;
  customerId: string;
  customerName: string;
  phoneDisplay: string | null;
  serviceName: string | null;
  staffName: string | null;
  amountSpentLabel: string | null;
  checkedInAtLabel: string;
  lastVisitLabel: string | null;
};

export type MobileCheckInsSummary = {
  business: MobileBusiness;
  selectedDate: string;
  dateLabel: string;
  timezone: string;
  count: number;
  latestCheckInLabel: string | null;
  checkIns: MobileCheckInRecord[];
};

export type MobileCheckInLookupCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  lastVisitLabel: string | null;
  phoneDisplay: string | null;
};

export type MobileCheckInLookupResponse =
  | {
      status: 'new';
      normalizedPhone: string;
      displayPhone: string;
    }
  | {
      status: 'existing';
      customer: MobileCheckInLookupCustomer;
    }
  | {
      status: 'multiple';
      customers: MobileCheckInLookupCustomer[];
    };

export type MobileCheckInSubmissionInput = {
  customerId?: string;
  phone?: string;
  customerName?: string;
  customerEmail?: string;
};

export type MobileCheckInMutationResponse = {
  checkIn: MobileCheckInRecord;
};

export type MobileCustomerGroupBadge = {
  id: string;
  name: string;
  promotionSmsEnabled: boolean;
};

export type MobileCustomerRecord = {
  id: string;
  name: string;
  email: string | null;
  phoneDisplay: string | null;
  joinedLabel: string;
  lastVisitLabel: string;
  totalSpentLabel: string;
  smsConsent: boolean;
  smsOptedOut: boolean;
  dealSmsBlocked: boolean;
  visitsCount: number;
  groups: MobileCustomerGroupBadge[];
};

export type MobileCustomersSummary = {
  business: MobileBusiness;
  search: string;
  currentPage: number;
  totalPages: number;
  totalCustomers: number;
  pageSize: number;
  customers: MobileCustomerRecord[];
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

export async function fetchMobileAppointments(
  token: string,
  input?: { date?: string },
) {
  const query = new URLSearchParams();
  if (input?.date) {
    query.set('date', input.date);
  }

  return requestJson<MobileAppointmentsSummary>(
    `/api/mobile/appointments${query.toString() ? `?${query.toString()}` : ''}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function fetchMobileDeals(token: string) {
  return requestJson<MobileDealsSummary>('/api/mobile/deals', {
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

export async function fetchMobileCheckIns(
  token: string,
  input?: { date?: string },
) {
  const query = new URLSearchParams();
  if (input?.date) {
    query.set('date', input.date);
  }

  return requestJson<MobileCheckInsSummary>(
    `/api/mobile/checkins${query.toString() ? `?${query.toString()}` : ''}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function lookupMobileCheckIn(
  token: string,
  phone: string,
) {
  const query = new URLSearchParams({ phone });

  return requestJson<MobileCheckInLookupResponse>(
    `/api/mobile/checkins/lookup?${query.toString()}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function createMobileCheckIn(
  token: string,
  input: MobileCheckInSubmissionInput,
) {
  return requestJson<MobileCheckInMutationResponse>('/api/mobile/checkins', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function fetchMobileCustomers(
  token: string,
  input?: { page?: number; pageSize?: number; search?: string },
) {
  const query = new URLSearchParams();
  if (input?.page) {
    query.set('page', String(input.page));
  }
  if (input?.pageSize) {
    query.set('pageSize', String(input.pageSize));
  }
  if (input?.search) {
    query.set('search', input.search);
  }

  return requestJson<MobileCustomersSummary>(
    `/api/mobile/customers${query.toString() ? `?${query.toString()}` : ''}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
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
