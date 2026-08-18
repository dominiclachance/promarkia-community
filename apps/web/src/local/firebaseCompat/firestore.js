import { localClient } from '../../services/localClient.js';

const localDocuments = new Map();
const toDoc = (id, data) => ({ id: String(id), data: () => data, exists: () => data != null });
const toSnapshot = (rows) => ({ docs: rows.map((row) => toDoc(row.id, row)) });
const pathOf = (segments) => segments.filter((part) => part !== undefined && part !== null).map(String).join('/');

export const getFirestore = () => ({ mode: 'local' });
export const collection = (_db, ...segments) => ({ kind: 'collection', path: pathOf(segments), filters: [] });
export const doc = (_db, ...segments) => ({ kind: 'doc', path: pathOf(segments) });
export const where = (field, op, value) => ({ field, op, value });
export const query = (reference, ...filters) => ({ ...reference, filters });
export const serverTimestamp = () => new Date().toISOString();
export const arrayUnion = (...values) => ({ __localOperation: 'arrayUnion', values });
export const arrayRemove = (...values) => ({ __localOperation: 'arrayRemove', values });

function scheduleToCloud(row) {
  return {
    id: String(row.id), name: row.name, squadId: row.team_id,
    prompt: row.task, recurrence: row.recurrence, status: row.status,
    firstRunAt: row.next_run_at, nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at, lastError: row.last_error,
  };
}

export async function getDocs(reference) {
  if (reference.path === 'scheduledTasks') return toSnapshot((await localClient.schedules()).map(scheduleToCloud));
  if (/^scheduledTasks\/[^/]+\/runs$/.test(reference.path)) return toSnapshot([]);
  if (reference.path === 'notifications') return toSnapshot([]);
  if (reference.path === 'prompts') return toSnapshot([]);
  return toSnapshot([...localDocuments.entries()]
    .filter(([key]) => key.startsWith(`${reference.path}/`))
    .map(([key, value]) => ({ id: key.split('/').pop(), ...value })));
}

export async function getDoc(reference) {
  if (reference.path.startsWith('users/')) {
    const profile = await localClient.profile();
    return toDoc('local', { ...profile.preferences, email: profile.email, displayName: profile.display_name });
  }
  const value = localDocuments.get(reference.path);
  return toDoc(reference.path.split('/').pop(), value);
}

export async function addDoc(reference, payload) {
  if (reference.path === 'scheduledTasks') {
    const row = await localClient.createSchedule({
      name: payload.name, team_id: Number(payload.squadId), task: payload.prompt,
      recurrence: payload.recurrence || {}, timezone: payload.timezone || 'America/New_York',
      next_run_at: payload.nextRunAt || payload.firstRunAt, status: payload.status || 'active',
      require_approval: true,
    });
    return { id: String(row.id) };
  }
  const id = crypto.randomUUID();
  localDocuments.set(`${reference.path}/${id}`, payload);
  return { id };
}

function applyOperations(current, payload) {
  const next = { ...(current || {}) };
  Object.entries(payload).forEach(([key, value]) => {
    if (value?.__localOperation === 'arrayUnion') next[key] = [...new Set([...(next[key] || []), ...value.values])];
    else if (value?.__localOperation === 'arrayRemove') next[key] = (next[key] || []).filter((item) => !value.values.includes(item));
    else next[key] = value;
  });
  return next;
}

export async function setDoc(reference, payload, options = {}) {
  localDocuments.set(reference.path, options.merge ? applyOperations(localDocuments.get(reference.path), payload) : payload);
}

export async function updateDoc(reference, payload) {
  if (reference.path.startsWith('scheduledTasks/')) {
    const id = reference.path.split('/')[1];
    const rows = await localClient.schedules();
    const current = rows.find((row) => String(row.id) === String(id));
    if (current) await localClient.updateSchedule(id, {
      name: payload.name ?? current.name,
      team_id: Number(payload.squadId ?? current.team_id),
      task: payload.prompt ?? current.task,
      recurrence: payload.recurrence ?? current.recurrence,
      timezone: current.timezone,
      next_run_at: payload.nextRunAt ?? current.next_run_at,
      status: payload.status ?? current.status,
      require_approval: current.require_approval,
    });
    return;
  }
  localDocuments.set(reference.path, applyOperations(localDocuments.get(reference.path), payload));
}

export async function deleteDoc(reference) {
  if (reference.path.startsWith('scheduledTasks/')) await localClient.deleteSchedule(reference.path.split('/')[1]);
  localDocuments.delete(reference.path);
}

export function onSnapshot(reference, onValue, onError) {
  let stopped = false;
  const emit = async () => {
    try {
      const snapshot = reference.kind === 'doc' ? await getDoc(reference) : await getDocs(reference);
      if (!stopped) onValue(snapshot);
    } catch (error) {
      if (!stopped && onError) onError(error);
    }
  };
  emit();
  const timer = setInterval(emit, 5000);
  return () => { stopped = true; clearInterval(timer); };
}
