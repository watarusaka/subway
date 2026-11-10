import { test, expect } from '@playwright/test';
import { mockAuth, session, TOKEN_KEY, DATA_KEY, user } from './auth-fixture.js';

test.beforeEach(async({page})=>{await mockAuth(page);});
test('未ログインでは個人画面を表示せずGoogle OAuthとPKCEを使用する',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Googleでログイン'})).toBeVisible();
 await expect(page.locator('.calendar-panel')).toHaveCount(0);
 const appOrigin=new URL(page.url()).origin;
 const request=page.waitForRequest(r=>r.url().includes('/authorize?'));
 await page.getByRole('button',{name:'Googleでログイン'}).click();
 const url=new URL((await request).url());
 expect(url.searchParams.get('provider')).toBe('google');
 expect(url.searchParams.get('redirect_to')).toBe(`${appOrigin}/`);
 expect(url.searchParams.get('code_challenge')).toBeTruthy();
 expect(url.searchParams.get('code_challenge_method')).toBe('s256');
});
test('再起動後もログインを復元し、新規アカウントはサンプルを入れない',async({page,browser})=>{
 await page.goto('/');
 await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:TOKEN_KEY,session});
 await page.reload();
 await expect(page.locator('.calendar-panel')).toBeVisible();
 await expect(page.locator('.subscription-card')).toHaveCount(0);
 await page.reload();await expect(page.locator('.calendar-panel')).toBeVisible();
 await page.locator('.sidebar [data-nav="settings"]').click();
 await expect(page.locator('.account-section')).toContainText(user.email);
 const stored=await page.context().storageState();
 const reopened=await browser.newContext({storageState:stored});
 try {const restored=await reopened.newPage();await mockAuth(restored);await restored.goto(new URL('/',page.url()).href);await expect(restored.locator('.calendar-panel')).toBeVisible();}finally{await reopened.close();}
});
test('期限切れセッションを更新して復帰する',async({page})=>{
 await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify({...session,expires_at:1})),{key:TOKEN_KEY,session});
 const refresh=page.waitForRequest(r=>r.url().includes('/token?'));
 await page.goto('/');await refresh;
 await expect(page.locator('.calendar-panel')).toBeVisible();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).access_token,TOKEN_KEY)).toBe('refreshed-token');
});
test('ログアウトで画面を閉じ、保存データとログイン前のデータを残す',async({page})=>{
 await page.addInitScript(({key,session,dataKey})=>{if(!sessionStorage.getItem('seed')){localStorage.setItem(key,JSON.stringify(session));localStorage.setItem(dataKey,JSON.stringify({subscriptions:[],demo:false,budget:9000}));localStorage.setItem('subnote-v1','legacy-data');sessionStorage.setItem('seed','1')}},{key:TOKEN_KEY,session,dataKey:DATA_KEY});
 await page.goto('/');await page.locator('.sidebar [data-nav="settings"]').click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'ログアウト',exact:true}).click();
 await expect(page.getByRole('button',{name:'Googleでログイン'})).toBeVisible();
 expect(await page.evaluate(key=>localStorage.getItem(key),TOKEN_KEY)).toBeNull();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).budget,DATA_KEY)).toBe(9000);
 expect(await page.evaluate(()=>localStorage.getItem('subnote-v1'))).toBe('legacy-data');
});
test('異なるアカウントのデータを表示しない',async({page})=>{
 await page.addInitScript(({key,session,dataKey})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem(dataKey.replace(session.user.id,'another-user'),JSON.stringify({subscriptions:[{name:'別ユーザーの秘密'}]}));},{key:TOKEN_KEY,session,dataKey:DATA_KEY});
 await page.goto('/');await expect(page.locator('.calendar-panel')).toBeVisible();await expect(page.locator('#app')).not.toContainText('別ユーザーの秘密');
});
test('認証サーバーで拒否された保存セッションではアプリを開かない',async({page})=>{
 await page.route('https://subway-test.supabase.co/auth/v1/user',route=>route.fulfill({status:401,json:{message:'Invalid token'}}));
 await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:TOKEN_KEY,session});
 await page.goto('/');await expect(page.locator('#auth-message')).toContainText('ログインを確認できませんでした');await expect(page.locator('.calendar-panel')).toHaveCount(0);
});

test('ログイン前のデータは自動投入せず、確認後だけ取り込み元を残して保存する',async({page})=>{
 const legacy={subscriptions:[],demo:false,budget:7000};
 await page.addInitScript(({key,session,legacy})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('subnote-v1',JSON.stringify(legacy));},{key:TOKEN_KEY,session,legacy});
 await page.goto('/');await expect(page.locator('.calendar-panel')).toBeVisible();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).budget,DATA_KEY)).toBe(15000);
 await page.locator('.sidebar [data-nav="settings"]').click();
 await page.getByRole('button',{name:'ログイン前のデータを取り込む'}).click();
 await page.locator('#confirm-action').click();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).budget,DATA_KEY)).toBe(7000);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('subnote-v1')).budget)).toBe(7000);
});
