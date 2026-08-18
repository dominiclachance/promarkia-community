const STORAGE_KEY = 'promarkia_launch_attribution';
const ALLOWED = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];

export function captureLaunchAttribution() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const attribution = {};
  ALLOWED.forEach((key) => {
    const value = params.get(key);
    if (value) attribution[key] = value.slice(0, 100);
  });
  if (!attribution.utm_source && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname;
      if (host.includes('github.com')) attribution.utm_source = 'github';
      if (host.includes('producthunt.com')) attribution.utm_source = 'product_hunt';
    } catch {
      // Invalid referrers are ignored.
    }
  }
  if (Object.keys(attribution).length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...attribution,
      captured_at: new Date().toISOString(),
    }));
  }
  return getLaunchAttribution();
}

export function getLaunchAttribution() {
  if (typeof window === 'undefined') return {};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.fromEntries(
      [...ALLOWED, 'captured_at']
        .filter((key) => typeof saved[key] === 'string')
        .map((key) => [key, saved[key]])
    );
  } catch {
    return {};
  }
}
