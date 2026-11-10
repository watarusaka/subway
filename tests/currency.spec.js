import {test,expect,DATA_KEY} from './auth-fixture.js';
test('ドル入力で円換算し、再編集・再読込でも二重換算せず円表示を維持する',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'サブスクを追加',exact:true}).click();
 await page.getByLabel('サービス名').fill('ドル払いテスト');await page.getByLabel('通貨',{exact:true}).selectOption('USD');await page.getByLabel('料金（米ドル）').fill('20');
 await expect(page.locator('#currency-preview')).toContainText('¥3,100');
 await page.getByRole('dialog').getByRole('button',{name:'サブスクを追加',exact:true}).click();
 await page.locator('.sidebar [data-nav="subscriptions"]').click();const card=page.locator('.subscription-card').filter({hasText:'ドル払いテスト'});
 await expect(card).toContainText('¥3,100');await expect(card).toContainText('$20.00');
 await page.reload();await page.locator('.sidebar [data-nav="subscriptions"]').click();await card.click();await page.getByRole('button',{name:'編集',exact:true}).click();
 await expect(page.getByLabel('通貨',{exact:true})).toHaveValue('USD');await expect(page.getByLabel('料金（米ドル）')).toHaveValue('20');await page.getByRole('button',{name:'変更を保存',exact:true}).click();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).subscriptions.find(s=>s.name==='ドル払いテスト').price,DATA_KEY)).toBe(3100);
 await card.click();await page.getByRole('button',{name:'編集',exact:true}).click();await page.setViewportSize({width:320,height:844});
 await page.getByLabel('料金（米ドル）').fill('9.99');await expect(page.locator('#currency-preview')).toContainText('¥1,548');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'変更を保存',exact:true}).click();await expect(card).toContainText('¥1,548');
 await card.click();await page.getByRole('button',{name:'編集',exact:true}).click();await page.getByLabel('通貨',{exact:true}).selectOption('JPY');await page.getByLabel('料金（円）').fill('2000');await page.getByRole('button',{name:'変更を保存',exact:true}).click();await expect(card).toContainText('¥2,000');await expect(card.locator('.original-currency')).toHaveCount(0);
});
test('ドル情報をバックアップ・復元し、換算額が不整合なデータを拒否する',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'サブスクを追加',exact:true}).click();await page.getByLabel('サービス名').fill('年額ドル');await page.getByLabel('通貨',{exact:true}).selectOption('USD');await page.getByLabel('料金（米ドル）').fill('120');await page.getByLabel('支払いサイクル').selectOption('yearly');await page.getByRole('dialog').getByRole('button',{name:'サブスクを追加',exact:true}).click();
 const saved=await page.evaluate(key=>localStorage.getItem(key),DATA_KEY);const parsed=JSON.parse(saved);const s=parsed.subscriptions.at(-1);expect(s.price).toBe(18600);expect(s.originalPrice).toBe(120);expect(s.currency).toBe('USD');
 await page.locator('.sidebar [data-nav="settings"]').click();await page.locator('#import-file').setInputFiles({name:'usd.json',mimeType:'application/json',buffer:Buffer.from(saved)});await page.locator('#confirm-action').click();await page.locator('.sidebar [data-nav="subscriptions"]').click();await expect(page.locator('.subscription-card').filter({hasText:'年額ドル'})).toContainText('¥18,600');
 parsed.subscriptions.at(-1).price=120;await page.locator('.sidebar [data-nav="settings"]').click();await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(parsed))});await expect(page.locator('#toast')).toContainText('読み込めませんでした');
});
