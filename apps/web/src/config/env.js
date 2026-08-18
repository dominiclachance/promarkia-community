export const env = {
  apiHttpPath: import.meta.env.VITE_API_HTTP_PATH || '/api',
  apiWsPath: import.meta.env.VITE_API_WS_PATH || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api`,
  serverBase: import.meta.env.VITE_SERVER_BASE || window.location.origin,
  autogenServiceUserId: import.meta.env.VITE_AUTOGEN_SERVICE_USER_ID || 'local',
  conversationsApiUrl: import.meta.env.VITE_CONV_API_URL || window.location.origin,
};
