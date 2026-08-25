import { test, expect } from '@playwright/test';

test('proximity closes after armed entry then leaving threshold', async ({ page }) => {
    await page.goto('/tests/integration/harness.html?case=basic');
    await page.waitForFunction(() => Boolean(window.__select));
    await page.locator('.csel-root').click();
    await expect(page.locator('.csel-popover')).toBeVisible();

    // Клавиатурный сценарий: открыть заново, мышь далеко — не должно закрыться
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__api.open());
    await expect(page.locator('.csel-popover')).toBeVisible();

    // «Далёкое» движение мыши (курсор не входил в компонент после открытия)
    await page.mouse.move(1240, 660);
    await page.waitForTimeout(300);
    await expect(page.locator('.csel-popover')).toBeVisible();

    // Вход в popover → вооружение → уход за порог → закрытие
    const pop = await page.locator('.csel-popover').boundingBox();
    await page.mouse.move(pop.x + pop.width / 2, pop.y + pop.height / 2);
    await page.waitForTimeout(100);
    await page.mouse.move(1240, 660, { steps: 5 });
    await page.waitForTimeout(400);
    await expect(page.locator('.csel-popover')).not.toBeVisible();
});
