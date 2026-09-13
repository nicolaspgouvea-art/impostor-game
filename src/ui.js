import { getGameState, isOnline, roleSeen } from '#store';
import { $, escapeHtml, initials } from '#utils';

const screens = [...document.querySelectorAll('.screen')];
let toastTimer = null;

export function showScreen(name) {
  screens.forEach((screen) => screen.classList.toggle('active', screen.id === `screen-${name}`));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
}

export function setConnection() {
  const element = $('connection');
  if (!element) return;
  element.textContent = isOnline() ? 'ONLINE' : 'RECONECTANDO';
  element.classList.toggle('offline', !isOnline());
}

function currentPlayer(state) {
  return state?.players?.find((player) => player.id === state.room.currentPlayerId) || null;
}

function playerName(state, id) {
  return state?.players?.find((player) => player.id === id)?.name || 'Jogador';
}

function renderLobby(state) {
  $('player-count').textContent = state.players.length;
  const list = $('lobby-players');
  list.innerHTML = '';

  state.players.forEach((player) => {
    const item = document.createElement('div');
    item.className = 'player';
    item.innerHTML = `
      <div class="avatar">${escapeHtml(initials(player.name))}</div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(player.name)}${player.id === state.self.id ? ' • você' : ''}</div>
        <div class="player-meta">${player.isHost ? 'Host da sala' : 'Na sala'}</div>
      </div>
      ${player.isHost ? '<div class="host-badge">HOST</div>' : '<div class="online-dot"></div>'}`;
    list.appendChild(item);
  });

  const startButton = $('start-game');
  startButton.hidden = !state.self.isHost;
  startButton.disabled = state.players.length < 3;
  $('start-note').innerHTML = state.self.isHost
    ? (state.players.length < 3
      ? `Faltam <strong>${3 - state.players.length}</strong> jogador(es) para começar.`
      : 'Tudo pronto. Até <strong>10 jogadores</strong> podem entrar.')
    : 'Aguardando o host iniciar a partida.';
}

export function renderRole() {
  const state = getGameState();
  const role = state?.self?.role;
  if (!role) return;

  const word = $('role-word');
  const help = $('role-help');
  if (role.type === 'impostor') {
    word.textContent = 'IMPOSTOR';
    word.classList.add('impostor');
    help.textContent = 'Observe a pista inicial e as falas dos outros. Tente se misturar e descubra a palavra com no máximo duas tentativas.';
  } else {
    word.textContent = role.word || '—';
    word.classList.remove('impostor');
    help.textContent = 'Fale algo relacionado à palavra sem entregar demais para o impostor.';
  }
}

function renderMessages(state) {
  const box = $('messages');
  const previousBottomDistance = box.scrollHeight - box.scrollTop - box.clientHeight;
  const shouldStickBottom = previousBottomDistance < 80;
  box.innerHTML = '';
  let lastRound = null;

  (state.messages || []).forEach((message) => {
    if (message.round && message.round !== lastRound) {
      const divider = document.createElement('div');
      divider.className = 'system-line';
      divider.textContent = `Rodada ${message.round}`;
      box.appendChild(divider);
      lastRound = message.round;
    }

    const row = document.createElement('div');
    row.className = 'msg';
    row.innerHTML = `
      <div class="mini">${message.kind === 'system' ? '●' : escapeHtml(initials(message.authorName))}</div>
      <div class="bubble ${message.kind === 'system' ? 'system' : ''}">
        <div class="msg-name">${escapeHtml(message.authorName)}</div>
        <div class="msg-text">${escapeHtml(message.text)}</div>
      </div>`;
    box.appendChild(row);
  });

  if (!(state.messages || []).length) {
    const empty = document.createElement('div');
    empty.className = 'tiny-note';
    empty.textContent = 'As pistas aparecerão aqui.';
    box.appendChild(empty);
  }

  if (shouldStickBottom) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

function renderGame(state) {
  $('round-value').textContent = Math.max(1, state.room.round || 1);
  const current = currentPlayer(state);
  $('turn-value').textContent = current?.name || '-';
  $('current-player').textContent = current ? `${current.name} está falando` : 'Aguardando...';
  $('current-avatar').textContent = initials(current?.name);

  const myTurn = state.room.status === 'playing' && state.room.currentPlayerId === state.self.id;
  $('clue-input').disabled = !myTurn;
  $('send-clue').disabled = !myTurn;
  $('turn-subtitle').textContent = myTurn ? 'Sua vez: dê uma pista relacionada' : 'Aguardando a pista do jogador da vez';
  $('turn-wait').textContent = myTurn
    ? 'Sua vez. Escolha uma pista curta sem entregar demais.'
    : `Aguarde ${current?.name || 'o próximo jogador'} enviar.`;

  $('guess-button').hidden = !state.self.canGuess;
  if (state.self.canGuess) {
    $('guess-button').textContent = `Adivinhar palavra • ${state.self.attemptsRemaining} tentativa${state.self.attemptsRemaining === 1 ? '' : 's'}`;
  }
  $('end-game').hidden = !state.self.isHost;

  renderMessages(state);

  const voteBox = $('vote-open');
  voteBox.classList.toggle('locked', !state.room.canStartVote);
  $('start-vote').disabled = !state.room.canStartVote;
  $('vote-help').textContent = state.room.canStartVote
    ? 'A votação está liberada. Qualquer jogador pode iniciá-la.'
    : (state.room.round < 3
      ? 'A votação libera após 2 rodadas completas.'
      : 'Já houve uma votação nesta rodada. Complete a rodada para votar novamente.');
}

function renderVote(state) {
  if (state.room.status !== 'voting') return;
  const list = $('vote-list');
  list.innerHTML = '';

  state.players.filter((player) => player.id !== state.self.id).forEach((player) => {
    const label = document.createElement('label');
    label.className = 'vote-option';
    label.innerHTML = `
      <input type="radio" name="vote" value="${escapeHtml(player.id)}" ${state.voting?.hasVoted ? 'disabled' : ''}>
      <span class="vote-label">
        <span class="avatar">${escapeHtml(initials(player.name))}</span>
        <span style="font-weight:900">${escapeHtml(player.name)}</span>
        <span class="vote-check"></span>
      </span>`;
    list.appendChild(label);
  });

  const voting = state.voting || { submitted: 0, total: state.players.length, hasVoted: false };
  $('vote-progress').textContent = voting.hasVoted
    ? `Voto enviado • aguardando ${Math.max(0, voting.total - voting.submitted)} jogador(es)`
    : `${voting.submitted} de ${voting.total} votos enviados`;
  $('confirm-vote').disabled = Boolean(voting.hasVoted);
  $('confirm-vote').textContent = voting.hasVoted ? 'Voto confirmado' : 'Confirmar voto';
  $('end-game-vote').hidden = !state.self.isHost;
}

function renderResult(state) {
  if (state.room.status !== 'finished') return;
  $('result-title').textContent = state.room.resultTitle || 'Fim da partida';
  $('result-detail').textContent = state.room.resultDetail || '';
  $('result-word').textContent = state.reveal?.secretWord || '-';
  $('result-impostor').textContent = playerName(state, state.reveal?.impostorPlayerId);
}

export function renderState() {
  const state = getGameState();
  if (!state) return;

  $('room-code').textContent = state.room.code;
  $('game-room-code').textContent = state.room.code;
  renderLobby(state);
  renderGame(state);
  renderVote(state);
  renderResult(state);

  if (state.room.status === 'lobby') return showScreen('lobby');
  if (state.room.status === 'finished') return showScreen('result');
  if (state.self.role && !roleSeen()) {
    renderRole();
    return showScreen('role');
  }
  if (state.room.status === 'voting') return showScreen('vote');
  showScreen('game');
}

export function openGuessModal() {
  const state = getGameState();
  const used = state?.self?.attemptsUsed || 0;
  $('attempt-1').classList.toggle('used', used >= 1);
  $('attempt-2').classList.toggle('used', used >= 2);
  $('guess-input').value = '';
  $('guess-modal').classList.add('show');
  setTimeout(() => $('guess-input').focus(), 70);
}

export function closeGuessModal() {
  $('guess-modal').classList.remove('show');
  $('guess-input').value = '';
}

export function openEndModal() {
  if (getGameState()?.self?.isHost) $('end-modal').classList.add('show');
}

export function closeEndModal() {
  $('end-modal').classList.remove('show');
}
