import { POLL_HIDDEN_MS, POLL_VISIBLE_MS, supabase } from '#config';
import { gameApi } from '#api';
import { clearLocalSession, getGameState, getSession, setGameState, setOnline } from '#store';
import { renderState, setConnection, showScreen, toast } from '#ui';
import { roomGoneError } from '#utils';

let channel = null;
let pollTimer = null;
let refreshBusy = false;
let stopped = true;

export async function refreshState({ quiet = true } = {}) {
  const session = getSession();
  if (!session?.code || !session?.token || refreshBusy) return false;

  refreshBusy = true;
  try {
    const next = await gameApi.getState(session.code, session.token);
    setGameState(next);
    setOnline(true);
    setConnection();
    renderState();
    return true;
  } catch (error) {
    setOnline(false);
    setConnection();
    const roomGone = roomGoneError(error.message);
    if (!quiet || roomGone) toast(roomGone ? 'A sala foi encerrada.' : error.message);
    if (roomGone) {
      stopSync();
      clearLocalSession();
      showScreen('home');
    }
    return false;
  } finally {
    refreshBusy = false;
  }
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (stopped) return;
  const delay = document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
  pollTimer = setTimeout(async () => {
    await refreshState();
    schedulePoll();
  }, delay);
}

export function notifyRoom() {
  try {
    channel?.send({ type: 'broadcast', event: 'refresh', payload: { at: Date.now() } });
  } catch {
    // Polling remains the fallback.
  }
}

export function startSync() {
  stopSync();
  const session = getSession();
  const state = getGameState();
  if (!session?.code) return;

  stopped = false;
  const channelName = `impostor-${state?.room?.syncKey || session.code}`;
  channel = supabase
    .channel(channelName, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'refresh' }, () => refreshState())
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setOnline(true);
        setConnection();
      }
    });

  schedulePoll();
}

export function stopSync() {
  stopped = true;
  clearTimeout(pollTimer);
  pollTimer = null;
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

export function installSyncLifecycle() {
  window.addEventListener('online', () => {
    setOnline(true);
    setConnection();
    refreshState({ quiet: false });
  });

  window.addEventListener('offline', () => {
    setOnline(false);
    setConnection();
  });

  window.addEventListener('focus', () => refreshState());

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshState();
    if (!stopped) schedulePoll();
  });
}
