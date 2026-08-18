const base = (import.meta.env.VITE_LOCAL_API_BASE || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${base}/local${path}`, { ...options, headers });
  if (!response.ok) throw new Error((await response.text()) || `Local API error ${response.status}`);
  return response.status === 204 ? null : response.json();
}

export const localClient = {
  capabilities: () => request('/capabilities'),
  profile: () => request('/profile'),
  saveProfile: (body) => request('/profile', { method: 'PUT', body: JSON.stringify(body) }),
  schedules: () => request('/schedules'),
  createSchedule: (body) => request('/schedules', { method: 'POST', body: JSON.stringify(body) }),
  updateSchedule: (id, body) => request(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSchedule: (id) => request(`/schedules/${id}`, { method: 'DELETE' }),
  approvals: (status) => request(`/approvals${status ? `?status=${status}` : ''}`),
  approve: (id, note) => request(`/approvals/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) }),
  reject: (id, note) => request(`/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
  integrations: () => request('/integrations'),
  addIntegration: (body) => request('/integrations', { method: 'POST', body: JSON.stringify(body) }),
  deleteIntegration: (id) => request(`/integrations/${id}`, { method: 'DELETE' }),
  mcpServers: () => request('/mcp-servers'),
  addMcpServer: (body) => request('/mcp-servers', { method: 'POST', body: JSON.stringify(body) }),
  deleteMcpServer: (id) => request(`/mcp-servers/${id}`, { method: 'DELETE' }),
  provider: () => request('/provider'),
  saveProvider: (body) => request('/provider', { method: 'PUT', body: JSON.stringify(body) }),
  testProvider: (body) => request('/provider/test', { method: 'POST', body: JSON.stringify(body) }),
  launchpad: () => request('/launchpad'),
  usage: () => request('/usage'),
  updateBudget: (body) => request('/usage/budget', { method: 'PUT', body: JSON.stringify(body) }),
  artifacts: (sessionId) => request(`/artifacts${sessionId ? `?session_id=${sessionId}` : ''}`),
};
