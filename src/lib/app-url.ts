import { APP_URL } from '@/lib/brand';

function normalize(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function getConfiguredAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return envUrl ? normalize(envUrl) : normalize(APP_URL);
}

export function getAppBaseUrlFromRequest(requestUrl?: string): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return normalize(envUrl);
  }

  if (requestUrl) {
    try {
      return normalize(new URL(requestUrl).origin);
    } catch {
      // fall back below
    }
  }

  return normalize(APP_URL);
}
