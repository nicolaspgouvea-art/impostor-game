import { APP_VERSION, VERSION_CHECK_MS } from '#config';
import { toast } from '#ui';

let timer = null;
let checking = false;

export async function checkForNewVersion({ quiet = true } = {}) {
  if (checking) return false;
  checking = true;
  try {
    const response = await fetch(`./version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return false;
    const remote = await response.json();
    if (!remote?.version || remote.version === APP_VERSION) return false;

    if (!quiet) toast('Nova versão disponível. Atualizando...');
    const url = new URL(window.location.href);
    url.searchParams.set('v', remote.version);
    setTimeout(() => window.location.replace(url.toString()), quiet ? 0 : 650);
    return true;
  } catch {
    // Version check must never interrupt gameplay.
    return false;
  } finally {
    checking = false;
  }
}

export function startVersionWatcher() {
  clearInterval(timer);
  timer = setInterval(() => checkForNewVersion(), VERSION_CHECK_MS);
  window.addEventListener('focus', () => checkForNewVersion({ quiet: false }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForNewVersion();
  });
}
