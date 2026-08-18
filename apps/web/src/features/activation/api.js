import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/client.js';
import { env } from '../../config/env.js';
import { getCanonicalUid } from '../../utils/canonicalUid.js';
import { persistedActivationState } from './storage.js';
import { executeApprovedPlan } from './productionBridge.js';

function currentIdentity() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before using Promarkia.');
  const uid = getCanonicalUid(user);
  if (!uid) throw new Error('Promarkia could not resolve your account.');
  return { uid, user };
}

function activationStateRef(uid) {
  return doc(db, 'users', uid, 'activation', 'state');
}

export async function loadActivationState() {
  const { uid } = currentIdentity();
  const snapshot = await getDoc(activationStateRef(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function persistActivationState(state) {
  const { uid } = currentIdentity();
  const persisted = persistedActivationState(state);
  await setDoc(activationStateRef(uid), { ...persisted, updatedAt: serverTimestamp() }, { merge: true });
  return persisted;
}

function providerFromConnectionKey(key) {
  return key.replace(/ConnectionId$/, '').replace(/^googleCalendar$/i, 'googlecalendar').toLowerCase();
}

export async function listIntegrations() {
  const { uid } = currentIdentity();
  const connected = new Map();
  const userSnapshot = await getDoc(doc(db, 'users', uid));
  if (userSnapshot.exists()) {
    Object.entries(userSnapshot.data() || {}).forEach(([key, value]) => {
      if (key.endsWith('ConnectionId') && value) connected.set(providerFromConnectionKey(key), value);
    });
  }
  const integrations = await getDocs(collection(db, 'users', uid, 'integrations'));
  integrations.docs.forEach((integration) => {
    const connectionId = integration.data()?.connectionId;
    if (connectionId) connected.set(integration.id.toLowerCase(), connectionId);
  });
  return Promise.all([...connected.entries()].map(async ([provider, connectionId]) => {
    const statusUrl = new URL(`${env.serverBase}/api/composio/connection-status`);
    statusUrl.searchParams.set('user_id', uid);
    statusUrl.searchParams.set('toolkit', provider);
    statusUrl.searchParams.set('connection_id', connectionId);
    try {
      const response = await fetch(statusUrl);
      if (!response.ok) return { provider, connectionId, status: 'active', verified: false };
      const data = await response.json();
      if (data?.connected === false) {
        return { provider, connectionId, status: String(data.status || 'revoked').toLowerCase(), verified: true };
      }
      return {
        provider,
        connectionId,
        status: data?.connected === true || data?.assumed === true || data?.reason === 'upstream_unverifiable'
          ? 'active'
          : 'active',
        verified: data?.connected === true,
      };
    } catch {
      return { provider, connectionId, status: 'active', verified: false };
    }
  }));
}

async function authenticatedRequest(url, payload, timeoutMs = 180000) {
  const { user } = currentIdentity();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const token = await user.getIdToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Promarkia could not complete that request.');
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function analyzeWebsite(websiteUrl) {
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const endpoint = local
    ? '/local-api/analyze-website'
    : `${env.serverBase}/api/autogen/activation/analyze-website`;
  return authenticatedRequest(endpoint, { websiteUrl });
}

export async function requestIntake({ workflowId, missingFields }) {
  return {
    source: 'Launchpad brief',
    summary: missingFields?.length
      ? 'Complete the required details before approving the production squad run.'
      : 'Review the prefilled brief before approving the production squad run.',
    workflowId,
    questions: [],
  };
}

export const executePlan = executeApprovedPlan;
