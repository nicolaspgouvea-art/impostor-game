import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

const SUPABASE_URL = 'https://ovcewmizdgubsrxbfdji.supabase.co';
const SUPABASE_KEY = 'sb_publishable_56d33SHqfh3_WyQjApBUaw_Q5XKkkM-';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const STORAGE_KEY = 'impostor_game_session_v1';
const ROLE_SEEN_PREFIX = 'impostor_role_seen_';
let session = readSession();
let state = null;
let realtimeChannel = null;
let pollTimer = null;
let refreshBusy = false;
let actionBusy = false;
let online = navigator.onLine;

const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll('.screen')];

function showScreen(name){ screens.forEach(s=>s.classList.toggle('active',s.id===`screen-${name}`)); window.scrollTo({top:0,behavior:'smooth'}); }
function toast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove('show'),2300); }
function readSession(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null} }
function saveSession(value){ session=value; if(value)localStorage.setItem(STORAGE_KEY,JSON.stringify(value)); else localStorage.removeItem(STORAGE_KEY); }
function clearLocalSession(){ if(session?.code)localStorage.removeItem(ROLE_SEEN_PREFIX+session.code); saveSession(null); state=null; stopSync(); }
function roleSeen(){ return !!(session?.code && localStorage.getItem(ROLE_SEEN_PREFIX+session.code)==='1'); }
function markRoleSeen(){ if(session?.code)localStorage.setItem(ROLE_SEEN_PREFIX+session.code,'1'); }
function initials(name){ return (name||'?').trim().charAt(0).toUpperCase()||'?'; }
function escapeHtml(value){ return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function currentPlayer(){ return state?.players?.find(p=>p.id===state.room.currentPlayerId)||null; }
function playerName(id){ return state?.players?.find(p=>p.id===id)?.name||'Jogador'; }
function setConnection(){ const el=$('connection'); el.textContent=online?'ONLINE':'RECONECTANDO'; el.classList.toggle('offline',!online); }
function setButtonBusy(btn,busy,label){ if(!btn)return; if(busy){btn.dataset.old=btn.innerHTML;btn.disabled=true;btn.innerHTML=`<span class="loader"></span>${label||'Carregando'}`;}else{btn.disabled=false;if(btn.dataset.old){btn.innerHTML=btn.dataset.old;delete btn.dataset.old;}} }

async function rpc(name,args={}){
  const {data,error}=await supabase.rpc(name,args);
  if(error) throw new Error(cleanError(error.message));
  return data;
}
function cleanError(message){ return String(message||'Erro inesperado').replace(/^.*?:\s*/,'').replace(/CONTEXT:[\s\S]*$/,'').trim(); }

async function refreshState({quiet=true}={}){
  if(!session?.code||!session?.token||refreshBusy)return;
  refreshBusy=true;
  try{
    const next=await rpc('imp_get_state',{p_code:session.code,p_token:session.token});
    state=next; online=true; setConnection(); renderState();
  }catch(err){
    online=false; setConnection();
    const roomGone=/não pertence|expirou|não encontrada/i.test(err.message);
    if(!quiet||roomGone)toast(roomGone?'A sala foi encerrada.':err.message);
    if(roomGone){ clearLocalSession(); showScreen('home'); }
  }finally{refreshBusy=false;}
}

function startSync(){
  stopSync();
  if(!session?.code)return;
  realtimeChannel=supabase.channel(`impostor-${state?.room?.syncKey||session.code}`,{config:{broadcast:{self:false}}})
    .on('broadcast',{event:'refresh'},()=>refreshState())
    .subscribe(status=>{ online=status==='SUBSCRIBED'||navigator.onLine; setConnection(); });
  pollTimer=setInterval(()=>refreshState(),3000);
}
function stopSync(){ if(realtimeChannel){supabase.removeChannel(realtimeChannel);realtimeChannel=null;} if(pollTimer){clearInterval(pollTimer);pollTimer=null;} }
function notifyRoom(){ try{ realtimeChannel?.send({type:'broadcast',event:'refresh',payload:{at:Date.now()}}); }catch{} }

function renderState(){
  if(!state)return;
  $('room-code').textContent=state.room.code;
  $('game-room-code').textContent=state.room.code;
  renderLobby(); renderGame(); renderVote(); renderResult();

  if(state.room.status==='lobby'){ showScreen('lobby'); return; }
  if(state.room.status==='finished'){ showScreen('result'); return; }
  if(state.self.role && !roleSeen()){ renderRole(); showScreen('role'); return; }
  if(state.room.status==='voting'){ showScreen('vote'); return; }
  showScreen('game');
}

function renderLobby(){
  if(!state)return;
  $('player-count').textContent=state.players.length;
  const list=$('lobby-players'); list.innerHTML='';
  state.players.forEach(p=>{
    const item=document.createElement('div'); item.className='player';
    item.innerHTML=`<div class="avatar">${escapeHtml(initials(p.name))}</div><div class="player-info"><div class="player-name">${escapeHtml(p.name)}${p.id===state.self.id?' • você':''}</div><div class="player-meta">${p.isHost?'Host da sala':'Na sala'}</div></div>${p.isHost?'<div class="host-badge">HOST</div>':'<div class="online-dot"></div>'}`;
    list.appendChild(item);
  });
  const btn=$('start-game');
  btn.hidden=!state.self.isHost;
  btn.disabled=state.players.length<3;
  $('start-note').innerHTML=state.self.isHost
    ? (state.players.length<3?`Faltam <strong>${3-state.players.length}</strong> jogador(es) para começar.`:`Tudo pronto. Até <strong>10 jogadores</strong> podem entrar.`)
    :'Aguardando o host iniciar a partida.';
}

function renderRole(){
  const role=state?.self?.role; if(!role)return;
  const word=$('role-word'),help=$('role-help');
  if(role.type==='impostor'){
    word.textContent='IMPOSTOR'; word.classList.add('impostor');
    help.textContent='Observe a pista inicial e as falas dos outros. Tente se misturar e descubra a palavra com no máximo duas tentativas.';
  }else{
    word.textContent=role.word||'—'; word.classList.remove('impostor');
    help.textContent='Fale algo relacionado à palavra sem entregar demais para o impostor.';
  }
}

function renderGame(){
  if(!state)return;
  $('round-value').textContent=Math.max(1,state.room.round||1);
  const current=currentPlayer();
  $('turn-value').textContent=current?.name||'-'; $('current-player').textContent=current?`${current.name} está falando`:'Aguardando...'; $('current-avatar').textContent=initials(current?.name);
  const myTurn=state.room.status==='playing'&&state.room.currentPlayerId===state.self.id;
  $('clue-input').disabled=!myTurn; $('send-clue').disabled=!myTurn;
  $('turn-subtitle').textContent=myTurn?'Sua vez: dê uma pista relacionada':'Aguardando a pista do jogador da vez';
  $('turn-wait').textContent=myTurn?'Você tem a palavra. Escolha uma pista curta.':`Aguarde ${current?.name||'o próximo jogador'} enviar.`;
  $('guess-button').hidden=!state.self.canGuess;
  if(state.self.canGuess)$('guess-button').textContent=`Adivinhar palavra • ${state.self.attemptsRemaining} tentativa${state.self.attemptsRemaining===1?'':'s'}`;
  $('end-game').hidden=!state.self.isHost;
  renderMessages();
  const vote=$('vote-open'); vote.classList.toggle('locked',!state.room.canStartVote);
  $('start-vote').disabled=!state.room.canStartVote;
  $('vote-help').textContent=state.room.canStartVote?'A votação está liberada. Qualquer jogador pode iniciá-la.':(state.room.round<3?'A votação libera após 2 rodadas completas.':'Já houve uma votação nesta rodada. Complete a rodada para votar novamente.');
}

function renderMessages(){
  const box=$('messages'); box.innerHTML='';
  let lastRound=null;
  (state.messages||[]).forEach(m=>{
    if(m.round&&m.round!==lastRound){ const divider=document.createElement('div'); divider.className='system-line'; divider.textContent=`Rodada ${m.round}`; box.appendChild(divider); lastRound=m.round; }
    const row=document.createElement('div'); row.className='msg';
    row.innerHTML=`<div class="mini">${m.kind==='system'?'🤖':escapeHtml(initials(m.authorName))}</div><div class="bubble ${m.kind==='system'?'system':''}"><div class="msg-name">${escapeHtml(m.authorName)}</div><div class="msg-text">${escapeHtml(m.text)}</div></div>`;
    box.appendChild(row);
  });
  if(!(state.messages||[]).length){ const e=document.createElement('div');e.className='tiny-note';e.textContent='As pistas aparecerão aqui.';box.appendChild(e); }
  requestAnimationFrame(()=>box.scrollTop=box.scrollHeight);
}

function renderVote(){
  if(!state||state.room.status!=='voting')return;
  const list=$('vote-list'); list.innerHTML='';
  state.players.filter(p=>p.id!==state.self.id).forEach(p=>{
    const label=document.createElement('label'); label.className='vote-option';
    label.innerHTML=`<input type="radio" name="vote" value="${escapeHtml(p.id)}" ${state.voting?.hasVoted?'disabled':''}><span class="vote-label"><span class="avatar">${escapeHtml(initials(p.name))}</span><span style="font-weight:900">${escapeHtml(p.name)}</span><span class="vote-check"></span></span>`;
    list.appendChild(label);
  });
  const v=state.voting||{submitted:0,total:state.players.length,hasVoted:false};
  $('vote-progress').textContent=v.hasVoted?`Voto enviado • aguardando ${Math.max(0,v.total-v.submitted)} jogador(es)`:`${v.submitted} de ${v.total} votos enviados`;
  $('confirm-vote').disabled=!!v.hasVoted; $('confirm-vote').textContent=v.hasVoted?'Voto confirmado':'Confirmar voto';
  $('end-game-vote').hidden=!state.self.isHost;
}

function renderResult(){
  if(!state||state.room.status!=='finished')return;
  $('result-title').textContent=state.room.resultTitle||'Fim da partida'; $('result-detail').textContent=state.room.resultDetail||'';
  $('result-word').textContent=state.reveal?.secretWord||'-'; $('result-impostor').textContent=playerName(state.reveal?.impostorPlayerId);
}

async function createRoom(){
  if(actionBusy)return; const name=$('create-name').value.trim(); if(!name)return toast('Digite seu nome.');
  actionBusy=true; setButtonBusy($('create-submit'),true,'Criando');
  try{ const data=await rpc('imp_create_room',{p_name:name}); saveSession({code:data.state.room.code,token:data.token}); state=data.state; localStorage.removeItem(ROLE_SEEN_PREFIX+session.code); startSync(); notifyRoom(); renderState(); }
  catch(err){toast(err.message)} finally{actionBusy=false;setButtonBusy($('create-submit'),false)}
}
async function joinRoom(){
  if(actionBusy)return; const code=$('join-code').value.replace(/\D/g,''); const name=$('join-name').value.trim(); if(code.length!==6)return toast('O código precisa ter 6 números.'); if(!name)return toast('Digite seu nome.');
  actionBusy=true;setButtonBusy($('join-submit'),true,'Entrando');
  try{const data=await rpc('imp_join_room',{p_code:code,p_name:name});saveSession({code:data.state.room.code,token:data.token});state=data.state;localStorage.removeItem(ROLE_SEEN_PREFIX+session.code);startSync();notifyRoom();renderState();}
  catch(err){toast(err.message)}finally{actionBusy=false;setButtonBusy($('join-submit'),false)}
}
async function startGame(){ if(actionBusy)return; actionBusy=true;setButtonBusy($('start-game'),true,'Iniciando');try{state=await rpc('imp_start_game',{p_code:session.code,p_token:session.token});localStorage.removeItem(ROLE_SEEN_PREFIX+session.code);notifyRoom();renderState();}catch(err){toast(err.message)}finally{actionBusy=false;setButtonBusy($('start-game'),false)} }
async function submitClue(){ if(actionBusy)return;const text=$('clue-input').value.trim();if(!text)return toast('Digite uma pista.');actionBusy=true;$('send-clue').disabled=true;try{state=await rpc('imp_submit_clue',{p_code:session.code,p_token:session.token,p_text:text});$('clue-input').value='';notifyRoom();renderState();}catch(err){toast(err.message)}finally{actionBusy=false;renderGame()} }
async function startVote(){ if(actionBusy||!state?.room?.canStartVote)return;actionBusy=true;try{state=await rpc('imp_start_vote',{p_code:session.code,p_token:session.token});notifyRoom();renderState();}catch(err){toast(err.message)}finally{actionBusy=false} }
async function confirmVote(){ if(actionBusy)return;const selected=document.querySelector('input[name="vote"]:checked');if(!selected)return toast('Escolha um jogador.');actionBusy=true;setButtonBusy($('confirm-vote'),true,'Votando');try{state=await rpc('imp_vote',{p_code:session.code,p_token:session.token,p_target_player_id:selected.value});notifyRoom();renderState();}catch(err){toast(err.message)}finally{actionBusy=false;if(state?.room?.status==='voting')renderVote()} }
async function submitGuess(){ if(actionBusy)return;const guess=$('guess-input').value.trim();if(!guess)return toast('Digite uma palavra.');actionBusy=true;setButtonBusy($('submit-guess'),true,'Verificando');try{const data=await rpc('imp_guess',{p_code:session.code,p_token:session.token,p_guess:guess});state=data.state;notifyRoom();closeGuess();if(data.correct)toast('Você acertou a palavra!');else toast(state.self.attemptsRemaining?`Errado. Restam ${state.self.attemptsRemaining} tentativa(s).`:'Errado. Suas tentativas acabaram.');renderState();}catch(err){toast(err.message)}finally{actionBusy=false;setButtonBusy($('submit-guess'),false)} }
async function closeCurrentRoom(){ if(!session)return; if(state?.self?.isHost){ try{await rpc('imp_close_room',{p_code:session.code,p_token:session.token});notifyRoom();}catch{} } clearLocalSession(); }
async function leaveLobby(){ if(!session)return showScreen('home'); try{await rpc('imp_leave_room',{p_code:session.code,p_token:session.token});notifyRoom();}catch(err){toast(err.message);return;} clearLocalSession();showScreen('home'); }
async function endGameByHost(){
  if(actionBusy||!session||!state?.self?.isHost)return;
  actionBusy=true; setButtonBusy($('confirm-end-game'),true,'Encerrando');
  try{
    await rpc('imp_close_room',{p_code:session.code,p_token:session.token});
    notifyRoom(); closeEndModal(); clearLocalSession(); showScreen('home'); toast('Partida encerrada para todos.');
  }catch(err){ toast(err.message); }
  finally{ actionBusy=false; setButtonBusy($('confirm-end-game'),false); }
}

function openGuess(){ const used=state?.self?.attemptsUsed||0;$('attempt-1').classList.toggle('used',used>=1);$('attempt-2').classList.toggle('used',used>=2);$('guess-input').value='';$('guess-modal').classList.add('show');setTimeout(()=>$('guess-input').focus(),70); }
function closeGuess(){ $('guess-modal').classList.remove('show');$('guess-input').value=''; }
function openEndModal(){ if(state?.self?.isHost)$('end-modal').classList.add('show'); }
function closeEndModal(){ $('end-modal').classList.remove('show'); }

$('home-create').addEventListener('click',()=>showScreen('create')); $('home-join').addEventListener('click',()=>showScreen('join')); document.querySelectorAll('.back-home').forEach(b=>b.addEventListener('click',()=>showScreen('home')));
$('create-submit').addEventListener('click',createRoom); $('join-submit').addEventListener('click',joinRoom); $('start-game').addEventListener('click',startGame); $('send-clue').addEventListener('click',submitClue); $('start-vote').addEventListener('click',startVote); $('confirm-vote').addEventListener('click',confirmVote);
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state?.room?.code||'');toast('Código copiado.')}catch{toast(`Código: ${state?.room?.code||''}`)}});
$('role-ready').addEventListener('click',()=>{markRoleSeen();renderState()}); $('guess-button').addEventListener('click',openGuess); $('cancel-guess').addEventListener('click',closeGuess); $('submit-guess').addEventListener('click',submitGuess);
$('lobby-exit').addEventListener('click',leaveLobby); $('game-exit').addEventListener('click',()=>toast(state?.self?.isHost?'Use “Encerrar partida” para fechar a sala para todos.':'A partida continua enquanto a sala estiver ativa.'));
$('end-game').addEventListener('click',openEndModal); $('end-game-vote').addEventListener('click',openEndModal); $('cancel-end-game').addEventListener('click',closeEndModal); $('confirm-end-game').addEventListener('click',endGameByHost);
$('new-room').addEventListener('click',async()=>{await closeCurrentRoom();showScreen('create')}); $('finish-home').addEventListener('click',async()=>{await closeCurrentRoom();showScreen('home')});
$('join-code').addEventListener('input',e=>e.target.value=e.target.value.replace(/\D/g,'').slice(0,6)); $('clue-input').addEventListener('keydown',e=>{if(e.key==='Enter')submitClue()}); $('guess-input').addEventListener('keydown',e=>{if(e.key==='Enter')submitGuess()});
window.addEventListener('online',()=>{online=true;setConnection();refreshState()}); window.addEventListener('offline',()=>{online=false;setConnection()});

async function boot(){ setConnection(); if(session?.code&&session?.token){ await refreshState({quiet:false}); if(state)startSync(); } else showScreen('home'); }
boot();