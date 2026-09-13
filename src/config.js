import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

export const APP_VERSION = '2026.09.13.2';
export const STORAGE_KEY = 'impostor_game_session_v1';
export const ROLE_SEEN_PREFIX = 'impostor_role_seen_';
export const POLL_VISIBLE_MS = 2500;
export const POLL_HIDDEN_MS = 7000;
export const VERSION_CHECK_MS = 60000;

const SUPABASE_URL = 'https://ovcewmizdgubsrxbfdji.supabase.co';
const SUPABASE_KEY = 'sb_publishable_56d33SHqfh3_WyQjApBUaw_Q5XKkkM-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
