import { test, expect } from '@playwright/test';

// Регрессии по баг-репорту демо (пустой single select + содержимое popover).

test.describe('regression: empty single select chrome', () => {
    test('hides «...» and «×» when nothing is selected', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        await expect(page.locator('.csel-root .csel-more')).toBeHidden();
        await expect(page.locator('.csel-root .csel-clear')).toBeHidden();
    });

    test('single-mode popover hides batch buttons, keeps search', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await expect(page.locator('.csel-select-all')).toBeHidden();
        await expect(page.locator('.csel-clear-all')).toBeHidden();
        await expect(page.locator('.csel-search-header')).toBeVisible();
    });
});

test.describe('regression: popover sized to content', () => {
    test('options are inside the visible popover area', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await expect(page.locator('.csel-popover')).toBeVisible();

        const geo = await page.evaluate(() => {
            const pop = document.querySelector('.csel-popover').getBoundingClientRect();
            const lb = document.querySelector('.csel-listbox');
            const first = lb.querySelector('[role="option"]')?.getBoundingClientRect();
            return {
                popH: pop.height,
                listboxClientH: lb.clientHeight,
                firstBottom: first?.bottom ?? -1,
                popBottom: pop.bottom,
                optionCount: lb.querySelectorAll('[role="option"]').length,
            };
        });
        expect(geo.optionCount).toBe(5);
        expect(geo.popH).toBeGreaterThan(150);
        expect(geo.listboxClientH).toBeGreaterThan(100);
        // первая опция целиком внутри видимой области popover
        expect(geo.firstBottom).toBeLessThanOrEqual(geo.popBottom + 1);
    });
});

test.describe('regression: multiple placeholder visibility', () => {
    test('placeholder hidden while selection exists, returns after clearing', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multi');
        await page.waitForFunction(() => Boolean(window.__select));

        // harness multi стартует с selectedIds:['a']
        await expect(page.locator('.csel-root .csel-tag')).toHaveCount(1);
        const ph = page.locator('.csel-root .csel-placeholder');
        await expect(ph).toBeHidden();

        // снимаем последний тег крестиком → плейсхолдер возвращается
        await page.locator('.csel-root .csel-tag-remove').click();
        await expect(page.locator('.csel-root .csel-tag')).toHaveCount(0);
        await expect(ph).toBeVisible();
    });
});

test.describe('regression: scroll semantics per column mode', () => {
    test('single column: vertical scrolling works, no horizontal scrollbar', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=tallSingle');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();

        const before = await page.evaluate(() => {
            const lb = document.querySelector('.csel-listbox');
            return { sw: lb.scrollWidth, cw: lb.clientWidth, sh: lb.scrollHeight, ch: lb.clientHeight };
        });
        expect(before.sw).toBeLessThanOrEqual(before.cw + 1);
        expect(before.sh).toBeGreaterThan(before.ch);

        await page.locator('.csel-listbox').hover();
        await page.mouse.wheel(0, 240);
        await page.waitForTimeout(150);
        const scrollTop = await page.evaluate(() => document.querySelector('.csel-listbox').scrollTop);
        expect(scrollTop).toBeGreaterThan(0);
    });

    test('multi column: equal columns wrap downward, vertical overflow absent', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=columns');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();

        const m = await page.evaluate(() => {
            const lb = document.querySelector('.csel-listbox');
            const cs = getComputedStyle(lb);
            return {
                rows: cs.gridTemplateRows,
                sw: lb.scrollWidth, cw: lb.clientWidth,
                sh: lb.scrollHeight, ch: lb.clientHeight,
                firstColW: cs.gridTemplateColumns.split(' ')[0],
            };
        });
        expect(m.rows).toContain('36px');
        expect(m.sh).toBeLessThanOrEqual(m.ch + 1);
        expect(m.sw).toBeGreaterThan(m.cw);
        expect(parseFloat(m.firstColW)).toBeGreaterThan(100);
    });
});
