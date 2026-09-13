import { supabase } from '#config';
import { cleanError } from '#utils';

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(cleanError(error.message));
  return data;
}

export const gameApi = {
  createRoom(name) {
    return rpc('imp_create_room', { p_name: name });
  },
  joinRoom(code, name) {
    return rpc('imp_join_room', { p_code: code, p_name: name });
  },
  getState(code, token) {
    return rpc('imp_get_state', { p_code: code, p_token: token });
  },
  startGame(code, token) {
    return rpc('imp_start_game', { p_code: code, p_token: token });
  },
  submitClue(code, token, text) {
    return rpc('imp_submit_clue', { p_code: code, p_token: token, p_text: text });
  },
  startVote(code, token) {
    return rpc('imp_start_vote', { p_code: code, p_token: token });
  },
  vote(code, token, targetPlayerId) {
    return rpc('imp_vote', { p_code: code, p_token: token, p_target_player_id: targetPlayerId });
  },
  guess(code, token, guess) {
    return rpc('imp_guess', { p_code: code, p_token: token, p_guess: guess });
  },
  leaveRoom(code, token) {
    return rpc('imp_leave_room', { p_code: code, p_token: token });
  },
  closeRoom(code, token) {
    return rpc('imp_close_room', { p_code: code, p_token: token });
  },
};
