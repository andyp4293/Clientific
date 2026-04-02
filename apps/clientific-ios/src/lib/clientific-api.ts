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

export type MobileCustomerSmsFilter = '' | 'enabled' | 'opted_out' | 'denied' | 'no_phone';
export type MobileCustomerContactFilter = '' | 'email' | 'phone' | 'both';
export type MobileCustomerVisitFilter = '' | 'visited' | 'never';

export type MobileCustomerFilters = {
  group: string;
  sms: MobileCustomerSmsFilter;
  contact: MobileCustomerContactFilter;
  visit: MobileCustomerVisitFilter;
};

export type MobileCustomerGroupRecord = MobileCustomerGroupBadge & {
  membersCount: number;
};

export type MobileCustomerRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneDisplay: string | null;
  joinedLabel: string;
  lastVisitLabel: string;
  totalSpentLabel: string;
  segment: string;
  segmentLabel: string;
  smsConsent: boolean;
  smsOptedOut: boolean;
  dealSmsBlocked: boolean;
  visitsCount: number;
  groups: MobileCustomerGroupBadge[];
};

export type MobileCustomerCheckInHistory = {
  id: string;
  createdAtLabel: string;
  amountSpentLabel: string;
};

export type MobileCustomerAppointmentHistory = {
  id: string;
  startTimeLabel: string;
  status: string;
  statusLabel: string;
  serviceName: string;
  staffName: string | null;
};

export type MobileCustomerDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneDisplay: string | null;
  birthdayValue: string;
  birthdayLabel: string;
  notes: string | null;
  segment: string;
  segmentLabel: string;
  joinedLabel: string;
  lastVisitLabel: string;
  totalSpentLabel: string;
  smsConsent: boolean;
  smsOptedOut: boolean;
  dealSmsBlocked: boolean;
  visitsCount: number;
  appointmentsCount: number;
  groups: MobileCustomerGroupBadge[];
  checkIns: MobileCustomerCheckInHistory[];
  appointments: MobileCustomerAppointmentHistory[];
};

export type MobileCustomerSmsLog = {
  id: string;
  createdAt: string;
  createdAtLabel: string;
  messageType: string;
  messageTypeLabel: string;
  status: string;
  message: string;
};

export type MobileDirectMessageQuota = {
  limit: number;
  used: number;
  remaining: number;
  periodEnd: string;
  periodEndLabel: string;
  isActive: boolean;
};

export type MobileCustomerSmsLogSummary = {
  logs: MobileCustomerSmsLog[];
  quota: MobileDirectMessageQuota | null;
};

export type MobileCustomerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  birthday?: string | null;
  notes?: string | null;
  dealSmsBlocked?: boolean;
  groupIds?: string[];
};

export type MobileCustomerGroupInput = {
  name: string;
  promotionSmsEnabled?: boolean;
};

export type MobileCustomersSummary = {
  business: MobileBusiness;
  search: string;
  filters: MobileCustomerFilters;
  currentPage: number;
  totalPages: number;
  totalCustomers: number;
  pageSize: number;
  groups: MobileCustomerGroupRecord[];
  customers: MobileCustomerRecord[];
};

export type MobileServicesSummary = {
  business: MobileBusiness;
  counts: {
    services: number;
    activeServices: number;
    staff: number;
    activeStaff: number;
  };
  groups: Array<{
    id: string;
    name: string;
    sortOrder: number;
    servicesCount: number;
  }>;
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    duration: number;
    durationLabel: string;
    priceLabel: string;
    isActive: boolean;
    groupId: string | null;
    groupName: string | null;
    sortOrder: number;
  }>;
  staff: Array<{
    id: string;
    fullName: string;
    email: string | null;
    phoneDisplay: string;
    role: string | null;
    isActive: boolean;
    workDaysLabel: string;
    workHoursLabel: string;
    serviceCount: number;
    serviceNames: string[];
  }>;
};

export type MobileBusinessHoursSummary = {
  business: MobileBusiness;
  timezone: string;
  timezoneLabel: string;
  openDayCount: number;
  closureCount: number;
  hours: Array<{
    dayOfWeek: number;
    label: string;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
    timeRangeLabel: string;
  }>;
  closures: Array<{
    date: string;
    label: string | null;
    formattedDate: string;
  }>;
};

export type MobileBusinessHoursUpdateInput = {
  hours: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string | null;
    closeTime: string | null;
  }>;
  closures: Array<{
    date: string;
    label?: string | null;
  }>;
};

export type MobileReviewsSummary = {
  business: MobileBusiness;
  storeId: string | null;
  surveyPath: string | null;
  surveyUrl: string | null;
  publicReviewDestinations: Array<{
    label: string;
    url: string;
  }>;
  hasPublicDestinations: boolean;
  recentRequestsCount: number;
  recentRequests: Array<{
    id: string;
    recipientLabel: string;
    statusLabel: string;
    createdAtLabel: string;
  }>;
};

export type MobileAnalyticsRange = '7d' | '30d' | '90d';

export type MobileAnalyticsSummary = {
  business: MobileBusiness;
  range: MobileAnalyticsRange;
  stats: {
    totalRevenue: number;
    totalRevenueLabel: string;
    totalAppointments: number;
    newCustomers: number;
    avgRevenuePerVisit: number;
    avgRevenuePerVisitLabel: string;
  };
  revenueByWeek: Array<{
    label: string;
    revenue: number;
    revenueLabel: string;
  }>;
  appointmentsByStatus: Array<{
    status: string;
    label: string;
    count: number;
  }>;
  topServices: Array<{
    name: string;
    count: number;
    share: number;
  }>;
  customerSegments: Array<{
    segment: string;
    label: string;
    count: number;
  }>;
};

export type MobileBillingSummary = {
  business: MobileBusiness;
  currentPlanName: string;
  currentPlanPriceLabel: string;
  planSummary: string;
  subscriptionStatus: string;
  subscriptionStatusLabel: string;
  trialDaysRemaining: number | null;
  trialEndsAtLabel: string | null;
  nextBillingDateLabel: string | null;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    label: string;
  } | null;
  invoices: Array<{
    id: string;
    amountLabel: string;
    createdLabel: string | null;
    status: string;
    statusLabel: string;
    description: string | null;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
};

export type MobileAiReceptionistFaq = {
  question: string;
  answer: string;
};

export type MobileAiReceptionistSummary = {
  business: MobileBusiness;
  subscriptionPlan: string | null;
  hasAccess: boolean;
  aiReceptionistEnabled: boolean;
  aiReceptionistPhone: string | null;
  aiReceptionistGreeting: string | null;
  aiReceptionistFaq: MobileAiReceptionistFaq[];
  smsAiEnabled: boolean;
  smsAiPhoneNumber: string | null;
  smsAiGreeting: string | null;
  vapiPhoneNumber: string | null;
  unifiedNumber: string | null;
};

export type MobileAiReceptionistUpdateInput = {
  aiReceptionistEnabled?: boolean;
  aiReceptionistPhone?: string | null;
  aiReceptionistGreeting?: string | null;
  aiReceptionistFaq?: MobileAiReceptionistFaq[];
  smsAiGreeting?: string | null;
};

export type MobileCustomerViewDeal = {
  id: string;
  title: string;
  discountLabel: string;
  url: string;
};

export type MobileCustomerViewSummary = {
  business: MobileBusiness;
  storeId: string | null;
  bookingUrl: string | null;
  profileUrl: string | null;
  exploreUrl: string;
  deals: MobileCustomerViewDeal[];
};

export type MobileRedeemLookupResponse = {
  deal: {
    title: string;
    discountType: string;
    discountValue: number;
    discountLabel: string;
    platformFeePercent: number;
  };
  customer: {
    name: string;
    phoneDisplay: string;
  } | null;
  alreadyUsed: boolean;
};

export type MobileRedeemResult = {
  success: true;
  deal: {
    title: string;
    discountType: string;
    discountValue: number;
    discountLabel: string;
  };
  customer: {
    name: string;
    phoneDisplay: string;
  } | null;
  platformFee: number | null;
  platformFeeLabel: string | null;
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
  input?: {
    page?: number;
    pageSize?: number;
    search?: string;
    group?: string;
    sms?: MobileCustomerSmsFilter;
    contact?: MobileCustomerContactFilter;
    visit?: MobileCustomerVisitFilter;
  },
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
  if (input?.group) {
    query.set('group', input.group);
  }
  if (input?.sms) {
    query.set('sms', input.sms);
  }
  if (input?.contact) {
    query.set('contact', input.contact);
  }
  if (input?.visit) {
    query.set('visit', input.visit);
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

export async function createMobileCustomer(token: string, input: MobileCustomerInput) {
  return requestJson<{ customer: MobileCustomerRecord }>('/api/mobile/customers', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function fetchMobileCustomerDetail(token: string, customerId: string) {
  return requestJson<{ customer: MobileCustomerDetail }>(`/api/mobile/customers/${customerId}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function updateMobileCustomer(
  token: string,
  customerId: string,
  input: MobileCustomerInput,
) {
  return requestJson<{ customer: MobileCustomerDetail }>(`/api/mobile/customers/${customerId}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteMobileCustomer(token: string, customerId: string) {
  return requestJson<{ success: true }>(`/api/mobile/customers/${customerId}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileCustomerSmsLogs(token: string, customerId: string) {
  return requestJson<MobileCustomerSmsLogSummary>(`/api/mobile/customers/${customerId}/sms-logs`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function sendMobileCustomerMessage(
  token: string,
  customerId: string,
  message: string,
) {
  return requestJson<{ success: true; quota: MobileDirectMessageQuota | null }>(
    `/api/mobile/customers/${customerId}/message`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    },
  );
}

export async function createMobileCustomerGroup(token: string, input: MobileCustomerGroupInput) {
  return requestJson<{ group: MobileCustomerGroupRecord }>('/api/mobile/customer-groups', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function updateMobileCustomerGroup(
  token: string,
  groupId: string,
  input: MobileCustomerGroupInput,
) {
  return requestJson<{ group: MobileCustomerGroupRecord }>(`/api/mobile/customer-groups/${groupId}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function deleteMobileCustomerGroup(token: string, groupId: string) {
  return requestJson<{ success: true }>(`/api/mobile/customer-groups/${groupId}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileServices(token: string) {
  return requestJson<MobileServicesSummary>('/api/mobile/services', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileBusinessHours(token: string) {
  return requestJson<MobileBusinessHoursSummary>('/api/mobile/business-hours', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function updateMobileBusinessHours(
  token: string,
  input: MobileBusinessHoursUpdateInput,
) {
  return requestJson<MobileBusinessHoursSummary & { success: true }>('/api/mobile/business-hours', {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function fetchMobileReviews(token: string) {
  return requestJson<MobileReviewsSummary>('/api/mobile/reviews', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileAnalytics(
  token: string,
  input?: { range?: MobileAnalyticsRange },
) {
  const query = new URLSearchParams();
  if (input?.range) {
    query.set('range', input.range);
  }

  return requestJson<MobileAnalyticsSummary>(
    `/api/mobile/analytics${query.toString() ? `?${query.toString()}` : ''}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function fetchMobileBilling(token: string) {
  return requestJson<MobileBillingSummary>('/api/mobile/billing', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileAiReceptionist(token: string) {
  return requestJson<MobileAiReceptionistSummary>('/api/mobile/ai-receptionist', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function updateMobileAiReceptionist(
  token: string,
  input: MobileAiReceptionistUpdateInput,
) {
  return requestJson<MobileAiReceptionistSummary>('/api/mobile/ai-receptionist', {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function openMobileBillingPortal(token: string) {
  return requestJson<{ url: string }>('/api/mobile/billing/portal', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function lookupMobileRedemption(
  token: string,
  code: string,
) {
  const query = new URLSearchParams({ code });

  return requestJson<MobileRedeemLookupResponse>(
    `/api/mobile/redeem/lookup?${query.toString()}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function redeemMobileCode(
  token: string,
  input: { code: string; transactionAmount?: number | null },
) {
  return requestJson<MobileRedeemResult>('/api/mobile/redeem', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export async function fetchMobileBusinessProfile(token: string) {
  return requestJson<{ business: MobileBusinessProfile }>('/api/mobile/business', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchMobileCustomerView(token: string) {
  return requestJson<MobileCustomerViewSummary>('/api/mobile/customer-view', {
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
