const LAUNCHPAD_DISMISSED_PREFIX = 'promarkia.launchpad.dismissed';

function dismissalKey(uid) {
  return `${LAUNCHPAD_DISMISSED_PREFIX}.${uid}`;
}

export function shouldOpenLaunchpad(uid, storage = window.sessionStorage) {
  return Boolean(uid) && storage.getItem(dismissalKey(uid)) !== '1';
}

export function dismissLaunchpad(uid, storage = window.sessionStorage) {
  if (uid) storage.setItem(dismissalKey(uid), '1');
}

export function resetLaunchpadSession(storage = window.sessionStorage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(`${LAUNCHPAD_DISMISSED_PREFIX}.`)) storage.removeItem(key);
  }
}
