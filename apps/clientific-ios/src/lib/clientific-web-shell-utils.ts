export function isSupportedExternalScheme(url: string) {
  return (
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    url.startsWith('sms:') ||
    url.startsWith('maps:') ||
    url.startsWith('itms-apps:')
  );
}

export function isWebUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function getHostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'clientific.app';
  }
}

export function getPathLabel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/' ? 'Dashboard' : parsed.pathname;
  } catch {
    return 'Dashboard';
  }
}
