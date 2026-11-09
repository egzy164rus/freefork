/* Облако: вход по почте/паролю и Google + хранение данных пользователя в Supabase. */
(() => {
'use strict';
const cfg = window.FREEFORK_CONFIG || {};
const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase && window.supabase.createClient);
const Cloud = { enabled, user: null, google: !!cfg.google, ready: false };
const listeners = [];
Cloud.on = fn => listeners.push(fn);
const emit = (ev, session) => setTimeout(() => listeners.forEach(f => f(ev, session)), 0);

// Если сеть «подвисает» (бывает у заблокированных маршрутов), не ждём бесконечно.
function fetchWithTimeout(url, opts = {}) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 20000);
  if (opts.signal) opts.signal.addEventListener('abort', () => ctl.abort());
  return fetch(url, { ...opts, signal: ctl.signal }).finally(() => clearTimeout(tm));
}

let client = null;
if (enabled) {
  client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    global: { fetch: fetchWithTimeout },
  });
  client.auth.onAuthStateChange((event, session) => {
    Cloud.user = session ? session.user : null;
    Cloud.ready = true;
    emit(event, session);
  });
}

const redirectUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
const need = () => { if (!client) throw new Error('Cloud is not configured'); return client; };

Cloud.signUp = (email, password) => need().auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } });
Cloud.signIn = (email, password) => need().auth.signInWithPassword({ email, password });
Cloud.signInGoogle = () => need().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl() } });
Cloud.resetPassword = email => need().auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
Cloud.updatePassword = password => need().auth.updateUser({ password });
Cloud.signOut = () => need().auth.signOut();

/** Возвращает { data, updatedAt } или null, если в облаке ещё ничего нет. */
Cloud.pull = async () => {
  const { data, error } = await need().from('user_data').select('data,updated_at').maybeSingle();
  if (error) throw error;
  return data ? { data: data.data, updatedAt: data.updated_at } : null;
};
Cloud.push = async state => {
  if (!Cloud.user) throw new Error('not signed in');
  const { error } = await need().from('user_data').upsert(
    { user_id: Cloud.user.id, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
};
Cloud.deleteData = async () => {
  if (!Cloud.user) return;
  const { error } = await need().from('user_data').delete().eq('user_id', Cloud.user.id);
  if (error) throw error;
};
Cloud.deleteAccount = async () => {
  const { error } = await need().rpc('delete_my_account');
  if (error) throw error;
  await client.auth.signOut({ scope: 'local' }).catch(() => {});
};

window.Cloud = Cloud;
})();
