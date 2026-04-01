const DEFAULT_APP_URL = 'https://www.clientific.app';

function getCanonicalAppUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_CLIENTIFIC_WEB_URL?.trim();
  return (configuredUrl || DEFAULT_APP_URL).replace(/\/+$/, '');
}

export const APP_URL = getCanonicalAppUrl();
export const APP_SUPPORT_EMAIL = 'support@clientific.app';
export const APP_PRIVACY_URL = `${APP_URL}/privacy`;
export const APP_TERMS_URL = `${APP_URL}/terms`;
export const APP_SUPPORT_URL = `${APP_URL}/support`;
