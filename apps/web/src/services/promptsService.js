import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase/client';

// Helper: build possible squad_ID variants so we match number or string stored values
const buildSquadValues = (squadId) => {
  const vals = new Set();
  if (squadId !== undefined && squadId !== null) {
    vals.add(squadId);
    vals.add(String(squadId));
    if (typeof squadId === 'string' && /^-?\d+$/.test(squadId)) {
      vals.add(Number(squadId));
    }
    if (typeof squadId === 'number') {
      vals.add(String(squadId));
    }
  }
  return Array.from(vals);
};

// Helper: tolerant language match (accept 'en' for 'en-US' etc.)
const matchesLang = (docLang, wantLang) => {
  if (!docLang) return true;
  const want = String(wantLang || '').toLowerCase();
  const doc = String(docLang).toLowerCase();
  if (doc === 'all') return true;
  if (doc === want) return true;
  const wantRoot = want.split('-')[0];
  return doc === wantRoot || doc.startsWith(wantRoot);
};

export function subscribePromptsBySquadAndLang(squadId, lang, onUpdate, onError) {
  try {
    const squadValues = buildSquadValues(squadId);
    const q = (squadValues.length === 1)
      ? query(collection(db, 'prompts'), where('squad_ID', '==', squadValues[0]))
      : query(collection(db, 'prompts'), where('squad_ID', 'in', squadValues));

    const unsub = onSnapshot(q, (snap) => {
      const prompts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = prompts
        .filter(p => (p.enabled !== false) && matchesLang(p.language, lang))
        .sort((a, b) => {
          const A = (a.prompt_text || a.prompt || a.id || '').toString();
          const B = (b.prompt_text || b.prompt || b.id || '').toString();
          return A.localeCompare(B, undefined, { sensitivity: 'base', numeric: true });
        });
      if (typeof onUpdate === 'function') onUpdate(filtered);
    }, (err) => {
      console.error('[promptsService] onSnapshot error', err);
      if (typeof onError === 'function') onError(err);
    });
    return unsub;
  } catch (e) {
    console.error('[promptsService] subscribe threw', e);
    if (typeof onError === 'function') onError(e);
    return () => {};
  }
}

export async function fetchPromptsBySquadAndLang(squadId, lang) {
  try {
    const squadValues = buildSquadValues(squadId);
    const q = (squadValues.length === 1)
      ? query(collection(db, 'prompts'), where('squad_ID', '==', squadValues[0]))
      : query(collection(db, 'prompts'), where('squad_ID', 'in', squadValues));

    const snap = await getDocs(q);
    const prompts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtered = prompts
      .filter(p => (p.enabled !== false) && matchesLang(p.language, lang))
      .sort((a, b) => {
        const A = (a.prompt_text || a.prompt || a.id || '').toString();
        const B = (b.prompt_text || b.prompt || b.id || '').toString();
        return A.localeCompare(B, undefined, { sensitivity: 'base', numeric: true });
      });
    return filtered;
  } catch (e) {
    console.error('[promptsService] fetch error', e);
    throw e;
  }
}
