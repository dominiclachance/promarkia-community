const apiBase = (import.meta.env.VITE_LOCAL_API_BASE || '/api').replace(/\/$/, '');

export async function autogenBridgeFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (path === '/runs' && String(options.method || 'GET').toUpperCase() === 'POST') {
    headers.set('Idempotency-Key', headers.get('Idempotency-Key') || crypto.randomUUID());
  }
  return fetch(`${apiBase}${path}`, { ...options, headers });
}

export async function getAutogenWebSocketUrl(runId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const configured = import.meta.env.VITE_LOCAL_WS_BASE;
  const base = configured || `${protocol}//${window.location.host}/api/ws`;
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(runId)}`;
}
