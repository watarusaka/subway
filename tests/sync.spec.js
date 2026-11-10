import {test,expect} from '@playwright/test';
import {mockAuth,session,TOKEN_KEY,DATA_KEY} from './auth-fixture.js';
test('Macとスマホで登録・解約通知・予算・削除を同じアカウントに同期する',async({browser,baseURL})=>{
 let cloud=null;
 const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1100}}),browser.newContext({viewport:{width:390,height:844}})]);
 try{
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  for(const page of pages){
   await mockAuth(page);
   await page.route('https://subway-test.supabase.co/rest/v1/**',route=>{
    if(route.request().method()==='GET')return route.fulfill({json:cloud});
    const body=route.request().postDataJSON();
    if(body.p_user_id!==session.user.id)return route.fulfill({status:403,json:{code:'42501'}});
    if(body.p_expected_version!==(cloud?.version??0))return route.fulfill({status:409,json:{code:'P0001',message:'sync_conflict'}});
    cloud={payload:body.p_payload,version:(cloud?.version??0)+1};return route.fulfill({json:cloud});
   });
   await page.addInitScript(({key,session})=>{if(!sessionStorage.getItem('seed')){localStorage.setItem(key,JSON.stringify(session));sessionStorage.setItem('seed','1')}},{key:TOKEN_KEY,session});
  }
  const [mac,phone]=pages;
  await mac.goto(baseURL);await expect(mac.locator('#sync-state')).toHaveText('クラウドに同期済み');
  await mac.getByRole('button',{name:'サブスクを追加',exact:true}).click();
  await mac.getByLabel('サービス名').fill('端末間同期テスト');await mac.getByLabel('料金（円）').fill('1200');await mac.getByLabel('解約通知を設定する').check();await mac.getByRole('dialog').getByRole('button',{name:'サブスクを追加',exact:true}).click();
  await expect(mac.locator('#sync-state')).toHaveText('クラウドに同期済み');expect(cloud.payload.subscriptions[0].reminder.enabled).toBe(true);
  await phone.goto(baseURL);await expect(phone.locator('.subscription-card')).toContainText('端末間同期テスト');
  await mac.locator('.sidebar [data-nav="settings"]').click();await mac.getByLabel('月の予算（円）').fill('12345');await mac.getByRole('button',{name:'予算を保存'}).click();await expect(mac.locator('#sync-state')).toHaveText('クラウドに同期済み');
  await phone.getByRole('button',{name:'同期を確認'}).click();await phone.locator('.sidebar [data-nav="settings"]').click();await expect(phone.getByLabel('月の予算（円）')).toHaveValue('12345');
  await phone.locator('.sidebar [data-nav="subscriptions"]').click();await phone.locator('.subscription-card').click();
  await phone.getByRole('button',{name:'記録を削除',exact:true}).click();await phone.locator('#confirm-action').click();await expect(phone.locator('#sync-state')).toHaveText('クラウドに同期済み');
  await mac.getByRole('button',{name:'同期を確認'}).click();await mac.locator('.sidebar [data-nav="subscriptions"]').click();await expect(mac.locator('.subscription-card')).toHaveCount(0);
  expect(await mac.evaluate(key=>JSON.parse(localStorage.getItem(key)).budget,DATA_KEY)).toBe(12345);
 }finally{await Promise.all(contexts.map(c=>c.close()))}
});
