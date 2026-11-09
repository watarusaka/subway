import { test, expect } from '@playwright/test';

for (const width of [320, 390, 430]) {
  test(`縦画面${width}pxで全画面と登録フォームを操作できる`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const add = page.getByRole('button', { name: 'サブスクを追加', exact: true });
    expect((await add.boundingBox()).height).toBeGreaterThanOrEqual(44);
    for (const view of ['calendar', 'subscriptions', 'insights', 'settings']) {
      await page.locator(`.sidebar [data-nav="${view}"]`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await add.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('サービス名').fill('スマホ登録テスト');
    await page.getByLabel('料金（円）').fill('800');
    await page.getByRole('dialog').getByRole('button', { name: 'サブスクを追加', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.sidebar [data-nav="subscriptions"]').click();
    await expect(page.locator('.subscription-card').filter({ hasText: 'スマホ登録テスト' })).toBeVisible();
    await page.reload();
    await page.locator('.sidebar [data-nav="subscriptions"]').click();
    await expect(page.locator('.subscription-card').filter({ hasText: 'スマホ登録テスト' })).toBeVisible();
  });
}
