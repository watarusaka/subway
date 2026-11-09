import { createClient } from '@supabase/supabase-js';
import './style.css';
import './auth.css';

const app = document.querySelector('#app');
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = !!(url && key && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url));
const client = configured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
}) : null;
let mountedUser = null;
let working = false;
let revision = 0;
let loginFailure = '';
const pendingKey = 'subway-google-login-pending';
function clearCallback() {
  const clean = new URL(window.location.href);
  for (const key of ['code','error','error_code','error_description','sb_flow_id']) clean.searchParams.delete(key);
  if (/^#.*(?:access_token|error|refresh_token)=/.test(clean.hash)) clean.hash = '';
  window.history.replaceState(window.history.state, '', clean.href);
}
function describeFailure(error) {
  const code = typeof error?.code === 'string' && /^[a-z0-9_]{1,80}$/i.test(error.code) ? error.code : '';
  if (['pkce_code_verifier_not_found','flow_state_not_found','flow_state_expired','bad_code_verifier'].includes(code)) {
    return 'ログインの照合情報が見つからないか、期限が切れています。最初に開いたものと同じブラウザー・同じURLで、もう一度ログインしてください。';
  }
  if (error?.status === 401 || code === 'invalid_api_key') return 'ログイン先への接続設定を確認できませんでした。管理者にお問い合わせください。（接続キーの確認が必要です）';
  return `ログイン処理を完了できませんでした。もう一度お試しください。${code ? `（${code}）` : ''}`;
}

function loginScreen(message = '', loading = false) {
  app.innerHTML = `<main class="auth-page"><section class="auth-card" aria-labelledby="login-title"><img src="/app-icon.png" alt="" width="88" height="88" /><span class="auth-brand">subway</span><h1 id="login-title">サブスク管理を、あなたのペースで。</h1><p>Googleアカウントでログインして始めましょう。</p><button id="google-login" class="btn primary" ${!client || loading ? 'disabled' : ''}>${loading ? 'ログインを確認中…' : 'Googleでログイン'}</button><p id="auth-message" role="status"></p><p class="auth-note">ログイン状態はこのブラウザーに保存されます。<br />共有端末では、使い終わったらログアウトしてください。</p></section></main>`;
  document.querySelector('#auth-message').textContent = message;
  document.querySelector('#google-login').onclick = async () => {
    if (!client || working) return;
    working = true;
    loginScreen('Googleのログイン画面を開いています…', true);
    try {
      // OAuth PKCE requires browser storage to survive the round trip to Google.
      const probe = 'subway-auth-storage-check';
      try { localStorage.setItem(probe, probe); if (localStorage.getItem(probe) !== probe) throw new Error(); localStorage.removeItem(probe); }
      catch { throw new Error('storage-unavailable'); }
      loginFailure = '';
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL('/', window.location.origin).href, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
      if (!data.url) throw new Error('no-login-url');
      localStorage.setItem(pendingKey, String(Date.now()));
      window.location.assign(data.url);
    } catch (error) {
      working = false;
      loginScreen(error?.message === 'storage-unavailable' ? 'ブラウザーの保存機能が使えません。通常のブラウザーで保存を許可してから再度お試しください。' : 'ログイン画面を開けませんでした。少し待って再度お試しください。');
    }
  };
}

async function signOut() {
  if (!client || working) return;
  working = true;
  try {
    // Remove this browser's session; preserve the user's subscription data.
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    window.location.replace('/');
  } catch {
    working = false;
    window.alert('ログアウトできませんでした。通信状態を確認して再度お試しください。');
  }
}

async function restore(session) {
  const current = ++revision;
  if (!session) {
    if (mountedUser) { window.location.replace('/'); return; }
    loginScreen(loginFailure);
    return;
  }
  if (mountedUser === session.user.id) return;
  if (mountedUser) { window.location.replace('/'); return; }
  loginScreen('', true);
  try {
    // A locally stored session alone is not proof of the user's identity.
    const { data, error } = await client.auth.getUser();
    if (current !== revision) return;
    if (error || !data.user) throw error || new Error('No user');
    const user = data.user;
    const { startApp } = await import('./main.js');
    if (current !== revision) return;
    mountedUser = user.id;
    startApp(user, signOut);
  } catch {
    if (current === revision) loginScreen('ログインを確認できませんでした。通信状態を確認するか、もう一度ログインしてください。');
  }
}

async function initializeAuth() {
  if (!client) {
    loginScreen('ログインの準備中です。設定の完了後にご利用いただけます。');
    return;
  }
  loginScreen('', true);
  const callback = new URL(window.location.href);
  const fragment = new URLSearchParams(callback.hash.slice(1));
  const providerError = callback.searchParams.get('error') || fragment.get('error');
  const providerDescription = callback.searchParams.has('error_description') || fragment.has('error_description');
  try {
    if (providerError || providerDescription) {
      const reason = callback.searchParams.get('error_code') || fragment.get('error_code') || providerError;
      const safeReason = typeof reason === 'string' && /^[a-z0-9_]{1,80}$/i.test(reason) ? `（${reason}）` : '';
      loginFailure = `Googleからログインを完了できなかったという応答がありました。利用するアカウントがテストユーザーに登録されているか、GoogleとSupabaseの接続設定をご確認ください。${safeReason}`;
      // Do not render or log provider descriptions: they can contain sensitive details.
    } else if (callback.searchParams.has('code')) {
      const { error } = await client.auth.exchangeCodeForSession(callback.searchParams.get('code'));
      if (error) loginFailure = describeFailure(error);
    }
    const { data, error } = await client.auth.getSession();
    if (error) loginFailure = describeFailure(error);
    const pending = Number(localStorage.getItem(pendingKey));
    if (!data.session && !loginFailure && pending && Date.now() - pending < 15 * 60 * 1000) {
      loginFailure = 'Googleからログイン結果を受け取れませんでした。最初と同じブラウザー・同じURLでやり直してください。';
    }
    clearCallback();
    localStorage.removeItem(pendingKey);
    // Subscribe only after processing the callback. INITIAL_SESSION cannot erase its error.
    client.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => { void restore(session); });
    });
    await restore(data.session);
  } catch (error) {
    loginFailure = describeFailure(error);
    clearCallback();
    loginScreen(loginFailure);
  }
}
void initializeAuth();
