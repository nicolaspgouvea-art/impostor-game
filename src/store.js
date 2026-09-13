import { ROLE_SEEN_PREFIX, STORAGE_KEY } from '#config';

let session = readStoredSession();
let gameState = null;
let online = navigator.onLine;

function readStoredSession() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!value?.code || !value?.token) return null;
    return value;
  } catch {
    return null;
  }
}

export function getSession() { return session; }
export function getGameState() { return gameState; }
export function isOnline() { return online; }

export function setSession(value) {
  session = value;
  if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  else localStorage.removeItem(STORAGE_KEY);
}

export function setGameState(value) { gameState = value; }
export function setOnline(value) { online = Boolean(value); }

export function clearLocalSession() {
  if (session?.code) localStorage.removeItem(ROLE_SEEN_PREFIX + session.code);
  setSession(null);
  setGameState(null);
}

export function roleSeen() {
  return Boolean(session?.code && localStorage.getItem(ROLE_SEEN_PREFIX + session.code) === '1');
}

export function markRoleSeen() {
  if (session?.code) localStorage.setItem(ROLE_SEEN_PREFIX + session.code, '1');
}

export function resetRoleSeen() {
  if (session?.code) localStorage.removeItem(ROLE_SEEN_PREFIX + session.code);
}
