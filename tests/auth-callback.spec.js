import {test,expect} from '@playwright/test';
import {mockAuth,TOKEN_KEY} from './auth-fixture.js';
test('Googleへ遷移した同じブラウザーに戻った認証コードを交換してログインする',async({page})=>{
 await mockAuth(page);
 await page.goto('/');
 const origin=new URL(page.url()).origin;
 const authorize=page.waitForRequest(r=>r.url().includes('/authorize?'));
 await page.getByRole('button',{name:'Googleでログイン'}).click();
 await authorize;
 await page.goto(`${origin}/?code=test-authorization-code`);
 await expect(page.locator('.calendar-panel')).toBeVisible({timeout:15000});
 expect(await page.evaluate(key=>!!localStorage.getItem(key),TOKEN_KEY)).toBe(true);
 expect(new URL(page.url()).searchParams.has('code')).toBe(false);
});
test('認証コードが戻っても照合情報がなければ理由を表示する',async({page})=>{
 await mockAuth(page);await page.goto('/?code=missing-verifier-code');
 await expect(page.locator('#auth-message')).not.toBeEmpty();
});
test('Googleから戻ったエラーを空のログイン画面で上書きしない',async({page})=>{
 await mockAuth(page);await page.goto('/?error=access_denied&error_description=provider-failure');
 await expect(page.locator('#auth-message')).not.toBeEmpty();
});
test('キーが拒否された場合にログイン画面へ黙って戻らず、接続設定のエラーを残す',async({page})=>{
 await mockAuth(page);
 await page.route('https://subway-test.supabase.co/auth/v1/token?grant_type=pkce',route=>route.fulfill({status:401,json:{message:'Invalid API key',code:'invalid_api_key'}}));
 await page.goto('/');const origin=new URL(page.url()).origin;
 const authorize=page.waitForRequest(r=>r.url().includes('/authorize?'));
 await page.getByRole('button',{name:'Googleでログイン'}).click();await authorize;
 await page.goto(`${origin}/?code=rejected-code`);
 await expect(page.locator('#auth-message')).toContainText('接続キーの確認が必要');
 await expect(page.locator('.calendar-panel')).toHaveCount(0);
 expect(new URL(page.url()).searchParams.has('code')).toBe(false);
});
