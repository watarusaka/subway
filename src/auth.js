import { createClient } from '@supabase/supabase-js';
import './style.css';
import './auth.css';

const app = document.querySelector('#app');
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = !!(url && key && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url));
const client = configured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null;
let mountedUser = null;
let working = false;
let revision = 0;

function loginScreen(message = '', loading = false) {
  app.innerHTML = `<main class="auth-page"><section class="auth-card" aria-labelledby="login-title"><img src="/app-icon.png" alt="" width="88" height="88" /><span class="auth-brand">subway</span><h1 id="login-title">サブスク管理を、あなたのペースで。</h1><p>Googleアカウントでログインして始めましょう。</p><button id="google-login" class="btn primary" ${!client || loading ? 'disabled' : ''}>${loading ? 'ログインを確認中…' : 'Googleでログイン'}</button><p id="auth-message" role="status"></p><p class="auth-note">ログイン状態はこのブラウザーに保存されます。<br />共有端末では、使い終わったらログアウトしてください。</p></section></main>`;
  document.querySelector('#auth-message').textContent = message;
  document.querySelector('#google-login').onclick = async () => {
    if (!client || working) return;
    working = true;
    loginScreen('Googleのログイン画面を開いています…', true);
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL('/', window.location.origin).href, queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
    } catch {
      working = false;
      loginScreen('ログイン画面を開けませんでした。少し待って再度お試しください。');
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
    loginScreen();
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

if (!client) {
  loginScreen('ログインの準備中です。設定の完了後にご利用いただけます。');
} else {
  loginScreen('', true);
  // Defer auth calls outside the Supabase event callback to avoid lock contention.
  client.auth.onAuthStateChange((_event, session) => { queueMicrotask(() => { void restore(session); }); });
  client.auth.getSession().then(({ data, error }) => {
    if (error) { loginScreen('ログイン状態を読み込めませんでした。もう一度ログインしてください。'); return; }
    void restore(data.session);
  }).catch(() => loginScreen('ログインを確認できませんでした。もう一度お試しください。'));
}
