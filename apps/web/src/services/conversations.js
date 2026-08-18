import { env } from '../config/env';

// The local API owns conversation history and message persistence.
const API_BASE = import.meta.env.VITE_CONV_API_URL || env.serverBase;

function getEmailFallback() {
  return sessionStorage.getItem('email') || '';
}

async function safeJson(res) {
  try { return await res.json(); } catch (e) { return null; }
}

export async function fetchConversationsByEmail(email) {
  const resolvedEmail = email || getEmailFallback();
  if (!resolvedEmail) return [];
  const url = `${API_BASE}/api/conversations?email=${encodeURIComponent(resolvedEmail)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await safeJson(res) || [];
  } catch (err) {
    console.error('[conversations.service] fetchConversationsByEmail error', err);
    return [];
  }
}

export async function fetchConversationMessages(sessionId) {
  if (!sessionId) return [];
  const url = `${API_BASE}/api/conversations/${encodeURIComponent(sessionId)}/messages`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await safeJson(res) || [];
  } catch (err) {
    console.error('[conversations.service] fetchConversationMessages error', err);
    return [];
  }
}

export async function deleteConversationSession(sessionId) {
  if (!sessionId) return false;
  const url = `${API_BASE}/api/conversations/${encodeURIComponent(sessionId)}`;
  try {
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.error('[conversations.service] deleteConversationSession error', err);
    return false;
  }
}
