import { test, expect } from './auth-fixture.js';

test('subwayの表示・AIカテゴリ・タブ順・解約日の初期設定と9時通知',async({page})=>{
  await page.clock.install({time:new Date('2027-02-25T08:59:59+09:00')});
  await page.clock.pauseAt(new Date('2027-02-25T08:59:59+09:00'));
  await page.goto('/');
  await expect(page).toHaveTitle('subway — サブスク管理');
  await expect(page.getByRole('link',{name:'subway ホーム'})).toBeVisible();
  await expect(page.locator('.page-heading p')).toHaveCount(0);
  await page.getByRole('button',{name:'サブスクを追加',exact:true}).click();
  await page.getByLabel('サービス名').fill('AI通知');
  await page.getByLabel('料金（円）').fill('500');
  await page.locator('#subscription-form select[name="category"]').selectOption('AI');
  await page.getByLabel('支払い基準日').fill('2027-01-31');
  await page.getByLabel('解約通知を設定する').check();
  await expect(page.getByLabel(/^解約日/)).toHaveValue('2027-02-28');
  await expect(page.getByLabel('何日前に通知するか')).toHaveValue('3');
  await page.getByLabel(/^解約日/).fill('2027-03-05');
  await page.getByLabel('支払い基準日').fill('2027-02-01');
  await expect(page.getByLabel(/^解約日/)).toHaveValue('2027-03-05');
  await page.getByLabel(/^解約日/).fill('2027-02-28');
  await page.getByRole('dialog').getByRole('button',{name:'サブスクを追加',exact:true}).click();
  await expect(page.locator('#reminder-count')).toBeHidden();
  await page.getByRole('button',{name:'解約通知を確認'}).click();
  await expect(page.locator('.reminder-item')).toContainText('午前9時（日本時間）');
  await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await page.clock.runFor(1000);
  await expect(page.locator('#reminder-count')).toHaveText('1');
  await page.locator('nav [data-nav="subscriptions"]').click();
  await expect(page.locator('.status-tabs button')).toHaveText(['利用中','一時停止中','利用終了','すべて']);
  await expect(page.locator('.page-heading p')).toHaveCount(0);
  await page.getByLabel('カテゴリで絞り込み').selectOption('AI');
  await expect(page.locator('.subscription-card')).toHaveCount(1);
  await page.locator('nav [data-nav="insights"]').click();
  await expect(page.locator('.page-heading p')).toHaveCount(0);
});

test('解約通知の設定・指定形式・既読保存・オフ・ブラウザー通知',async({page})=>{
  await page.addInitScript(()=>{
    window.sentNotifications=[];
    window.Notification=class {
      static permission='default';
      static async requestPermission(){this.permission='granted';return 'granted';}
      constructor(title,options){window.sentNotifications.push({title,...options});}
      close(){}
    };
  });
  await page.goto('/');
  await page.getByRole('button',{name:'サブスクを追加',exact:true}).click();
  await page.getByLabel('サービス名').fill('通知テスト');
  await page.getByLabel('料金（円）').fill('1000');
  await page.getByLabel('解約通知を設定する').check();
  await page.getByLabel(/^解約日/).fill('2026-01-10');
  await page.getByLabel('何日前に通知するか').selectOption('7');
  await page.getByRole('dialog').getByRole('button',{name:'サブスクを追加',exact:true}).click();
  await expect(page.locator('#reminder-count')).toHaveText('1');
  await page.getByRole('button',{name:'解約通知を確認'}).click();
  await expect(page.locator('.reminder-message')).toHaveText('サブスク名：通知テスト\n解約日：2026/01/10');
  await page.getByRole('button',{name:'ブラウザー通知を有効にする'}).click();
  await expect.poll(()=>page.evaluate(()=>window.sentNotifications.length)).toBe(1);
  expect(await page.evaluate(()=>window.sentNotifications[0].body)).toBe('サブスク名：通知テスト\n解約日：2026/01/10');
  await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await page.getByRole('button',{name:'解約通知を確認'}).click();
  expect(await page.evaluate(()=>window.sentNotifications.length)).toBe(1);
  await page.getByRole('button',{name:'確認済みにする'}).click();
  await expect(page.locator('#reminder-count')).toBeHidden();
  await page.reload();
  await page.getByRole('button',{name:'解約通知を確認'}).click();
  await expect(page.locator('.reminder-item')).toContainText('確認済み');
  await page.getByRole('button',{name:'詳細',exact:true}).click();
  await page.getByRole('button',{name:'編集',exact:true}).click();
  await expect(page.getByLabel('何日前に通知するか')).toHaveValue('7');
  await page.getByLabel(/^解約日/).fill('2099-12-31');
  await page.getByLabel('何日前に通知するか').selectOption('30');
  await page.getByRole('button',{name:'変更を保存'}).click();
  await expect(page.locator('#reminder-count')).toBeHidden();
  await page.getByRole('button',{name:'解約通知を確認'}).click();
  await expect(page.locator('.reminder-item')).toContainText('通知予定：2099/12/01（30日前）');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'詳細',exact:true}).click();
  await page.getByRole('button',{name:'編集',exact:true}).click();
  await page.getByLabel('解約通知を設定する').uncheck();
  await page.getByRole('button',{name:'変更を保存'}).click();
  await page.getByRole('button',{name:'解約通知を確認'}).click();
  await expect(page.locator('.reminder-item')).toHaveCount(0);
});
