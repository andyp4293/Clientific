import { APP_URL } from '@/lib/brand';

function normalize(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function normalizeWebhookBase(url: string): string {
  const normalized = normalize(url);

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === 'clientific.app' || parsed.hostname === 'clientific.net') {
      parsed.hostname = `www.${parsed.hostname}`;
      return normalize(parsed.toString());
    }
    return normalize(parsed.toString());
  } catch {
    return normalized;
  }
}

export function getWebhookBaseUrl(url: string): string {
  return normalizeWebhookBase(url);
}

export function getConfiguredAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return envUrl ? normalize(envUrl) : normalize(APP_URL);
}

export function getConfiguredWebhookBaseUrl(): string {
  return getWebhookBaseUrl(getConfiguredAppBaseUrl());
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

export function getWebhookBaseUrlFromRequest(requestUrl?: string): string {
  return getWebhookBaseUrl(getAppBaseUrlFromRequest(requestUrl));
}
