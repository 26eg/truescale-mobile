export const DEFAULT_PREVIEW_URL = 'https://www.apple.com/';

export function isHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSupportedPreviewUrl(raw?: string | null): boolean {
  if (!raw || !isHttpUrl(raw)) return false;
  try {
    const parsed = new URL(raw.trim());
    const host = parsed.hostname.toLowerCase();
    if (host === 'chromewebstore.google.com') return false;
    if (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) return false;
    if (host === 'microsoftedge.microsoft.com' && parsed.pathname.startsWith('/addons')) return false;
    if (host === 'addons.mozilla.org') return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeTargetUrl(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return DEFAULT_PREVIEW_URL;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return isHttpUrl(trimmed) ? trimmed : DEFAULT_PREVIEW_URL;
  }
  if (/^(chrome|edge|about|chrome-extension|file):/i.test(trimmed)) {
    return DEFAULT_PREVIEW_URL;
  }
  const withScheme = `https://${trimmed}`;
  return isHttpUrl(withScheme) ? withScheme : DEFAULT_PREVIEW_URL;
}
