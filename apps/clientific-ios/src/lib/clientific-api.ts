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
  onboardingComplete: boolean;
};

export type MobileMetric = {
  label: string;
  value: number;
  helper: string;
};

export type MobileUpcomingAppointment = {
  id: string;
  customerName: string;
  serviceName: string;
  status: string;
  startTime: string;
  startTimeLabel: string;
};

export type MobileDashboardSummary = {
  business: MobileBusiness;
  metrics: MobileMetric[];
  upcomingAppointments: MobileUpcomingAppointment[];
  trialDaysRemaining: number | null;
};

export type MobileLoginResponse = {
  token: string;
  business: MobileBusiness;
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

export async function fetchMobileDashboardSummary(token: string) {
  return requestJson<MobileDashboardSummary>('/api/mobile/dashboard/summary', {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export function getClientificWebUrl() {
  return API_BASE_URL;
}
