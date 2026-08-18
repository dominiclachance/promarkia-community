import { localClient } from '../../services/localClient.js';

export const getFunctions = () => ({ mode: 'local' });
export const httpsCallable = (_functions, name) => async (payload = {}) => {
  if (name === 'manageMcpServers') {
    if (payload.action === 'list') return { data: { servers: await localClient.mcpServers() } };
    if (payload.action === 'create') return { data: await localClient.addMcpServer(payload.server || payload) };
  }
  return { data: { local: true, status: true } };
};
