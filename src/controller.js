import { gameApi } from '#api';
import {
  clearLocalSession,
  getGameState,
  getSession,
  markRoleSeen,
  resetRoleSeen,
  setGameState,
  setSession,
} from '#store';
import {
  closeEndModal,
  closeGuessModal,
  openEndModal,
  openGuessModal,
  renderState,
  setConnection,
  showScreen,
  toast,
} from '#ui';
import { $, setButtonBusy } from '#utils';
import { installSyncLifecycle, notifyRoom, refreshState, startSync, stopSync } from '#sync';
import { checkForNewVersion, startVersionWatcher } from '#version';

let actionBusy = false;

function state() { return getGameState(); }
function session() { return getSession(); }

async function createRoom() {
  if (actionBusy) return;
  const name = $('create-name').value.trim();
  if (!name) return toast('Digite seu nome.');

  actionBusy = true;
  setButtonBusy($('create-submit'), true, 'Criando');
  try {
    const data = await gameApi.createRoom(name);
    setSession({ code: data.state.room.code, token: data.token });
    setGameState(data.state);
    resetRoleSeen();
    startSync();
    notifyRoom();
    renderState();
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
    setButtonBusy($('create-submit'), false);
  }
}

async function joinRoom() {
  if (actionBusy) return;
  const code = $('join-code').value.replace(/\D/g, '');
  const name = $('join-name').value.trim();
  if (code.length !== 6) return toast('O código precisa ter 6 números.');
  if (!name) return toast('Digite seu nome.');

  actionBusy = true;
  setButtonBusy($('join-submit'), true, 'Entrando');
  try {
    const data = await gameApi.joinRoom(code, name);
    setSession({ code: data.state.room.code, token: data.token });
    setGameState(data.state);
    resetRoleSeen();
    startSync();
    notifyRoom();
    renderState();
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
    setButtonBusy($('join-submit'), false);
  }
}

async function startGame() {
  if (actionBusy) return;
  actionBusy = true;
  setButtonBusy($('start-game'), true, 'Iniciando');
  try {
    setGameState(await gameApi.startGame(session().code, session().token));
    resetRoleSeen();
    notifyRoom();
    renderState();
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
    setButtonBusy($('start-game'), false);
  }
}

async function submitClue() {
  if (actionBusy) return;
  const text = $('clue-input').value.trim();
  if (!text) return toast('Digite uma pista.');

  actionBusy = true;
  $('send-clue').disabled = true;
  try {
    setGameState(await gameApi.submitClue(session().code, session().token, text));
    $('clue-input').value = '';
    notifyRoom();
    renderState();
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
    renderState();
  }
}

async function startVote() {
  if (actionBusy || !state()?.room?.canStartVote) return;
  actionBusy = true;
  try {
    setGameState(await gameApi.startVote(session().code, session().token));
    notifyRoom();
    renderState();
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
  }
}

async function confirmVote() {
  if (actionBusy) return;
  const selected = document.querySelector('input[name="vote"]:checked');
  if (!selected) return toast('Escolha um jogador.');

  actionBusy = true;
  setButtonBusy($('confirm-vote'), true, 'Votando');
  try {
    setGameState(await gameApi.vote(session().code, session().token, selected.value));
    notifyRoom();
    renderState();
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
    setButtonBusy($('confirm-vote'), false);
    renderState();
  }
}

async function submitGuess() {
  if (actionBusy) return;
  const guess = $('guess-input').value.trim();
  if (!guess) return toast('Digite uma palavra.');

  actionBusy = true;
  setButtonBusy($('submit-guess'), true, 'Verificando');
  try {
    const data = await gameApi.guess(session().code, session().token, guess);
    setGameState(data.state);
    notifyRoom();
    closeGuessModal();
    toast(data.correct
      ? 'Você acertou a palavra!'
      : (state().self.attemptsRemaining
        ? `Errado. Restam ${state().self.attemptsRemaining} tentativa(s).`
        : 'Errado. Suas tentativas acabaram.'));
    renderState();
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
    setButtonBusy($('submit-guess'), false);
  }
}

async function leaveLobby() {
  if (!session()) return showScreen('home');
  try {
    await gameApi.leaveRoom(session().code, session().token);
    notifyRoom();
    stopSync();
    clearLocalSession();
    showScreen('home');
  } catch (error) {
    toast(error.message);
  }
}

async function closeCurrentRoom() {
  if (!session()) return;
  if (state()?.self?.isHost) {
    try {
      await gameApi.closeRoom(session().code, session().token);
      notifyRoom();
    } catch {
      // Returning home should still work if the room already ended.
    }
  }
  stopSync();
  clearLocalSession();
}

async function endGameByHost() {
  if (actionBusy || !session() || !state()?.self?.isHost) return;
  actionBusy = true;
  setButtonBusy($('confirm-end-game'), true, 'Encerrando');
  try {
    await gameApi.closeRoom(session().code, session().token);
    notifyRoom();
    closeEndModal();
    stopSync();
    clearLocalSession();
    showScreen('home');
    toast('Partida encerrada para todos.');
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
    setButtonBusy($('confirm-end-game'), false);
  }
}

function installEvents() {
  $('home-create').addEventListener('click', () => showScreen('create'));
  $('home-join').addEventListener('click', () => showScreen('join'));
  document.querySelectorAll('.back-home').forEach((button) => button.addEventListener('click', () => showScreen('home')));

  $('create-submit').addEventListener('click', createRoom);
  $('join-submit').addEventListener('click', joinRoom);
  $('start-game').addEventListener('click', startGame);
  $('send-clue').addEventListener('click', submitClue);
  $('start-vote').addEventListener('click', startVote);
  $('confirm-vote').addEventListener('click', confirmVote);

  $('copy-code').addEventListener('click', async () => {
    const code = state()?.room?.code || '';
    try {
      await navigator.clipboard.writeText(code);
      toast('Código copiado.');
    } catch {
      toast(`Código: ${code}`);
    }
  });

  $('role-ready').addEventListener('click', () => {
    markRoleSeen();
    renderState();
  });

  $('guess-button').addEventListener('click', openGuessModal);
  $('cancel-guess').addEventListener('click', closeGuessModal);
  $('submit-guess').addEventListener('click', submitGuess);

  $('lobby-exit').addEventListener('click', leaveLobby);
  $('game-exit').addEventListener('click', () => toast('A partida continua enquanto a sala estiver ativa.'));

  $('end-game').addEventListener('click', openEndModal);
  $('end-game-vote').addEventListener('click', openEndModal);
  $('cancel-end-game').addEventListener('click', closeEndModal);
  $('confirm-end-game').addEventListener('click', endGameByHost);
  $('end-modal').addEventListener('click', (event) => { if (event.target === $('end-modal')) closeEndModal(); });
  $('guess-modal').addEventListener('click', (event) => { if (event.target === $('guess-modal')) closeGuessModal(); });

  $('new-room').addEventListener('click', async () => {
    await closeCurrentRoom();
    showScreen('create');
  });
  $('finish-home').addEventListener('click', async () => {
    await closeCurrentRoom();
    showScreen('home');
  });

  $('join-code').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6);
  });
  $('create-name').addEventListener('keydown', (event) => { if (event.key === 'Enter') createRoom(); });
  $('join-name').addEventListener('keydown', (event) => { if (event.key === 'Enter') joinRoom(); });
  $('join-code').addEventListener('keydown', (event) => { if (event.key === 'Enter') joinRoom(); });
  $('clue-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') submitClue(); });
  $('guess-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') submitGuess(); });
}

export async function boot() {
  installEvents();
  installSyncLifecycle();
  startVersionWatcher();
  setConnection();

  if (await checkForNewVersion()) return;
  if (session()?.code && session()?.token) {
    const loaded = await refreshState({ quiet: false });
    if (loaded && state()) startSync();
  } else {
    showScreen('home');
  }
}
