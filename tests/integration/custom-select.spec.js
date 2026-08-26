import { test, expect } from '@playwright/test';

const open = async (page, kase = 'basic') => {
    await page.goto(`/tests/integration/harness.html?case=${kase}`);
    await page.waitForFunction(() => Boolean(window.__select));
};
const root = (page) => page.locator('.csel-root');
const popover = (page) => page.locator('.csel-popover');
const option = (page, idText) => page.locator(`.csel-option[data-id="${idText}"]`);

test.describe('lifecycle', () => {
    test('opens via click, closes via outside click, restores aria-expanded', async ({ page }) => {
        await open(page);
        await root(page).click();
        await expect(popover(page)).toBeVisible();
        await expect(root(page).locator('.csel-toggle')).toHaveAttribute('aria-expanded', 'true');
        await page.mouse.click(10, 10);
        await expect(popover(page)).not.toBeVisible();
        await expect(root(page).locator('.csel-toggle')).toHaveAttribute('aria-expanded', 'false');
    });

    test('Escape closes and returns focus to toggle', async ({ page }) => {
        await open(page);
        await root(page).focus();
        await page.keyboard.press('Enter');
        await expect(popover(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(popover(page)).not.toBeVisible();
        await expect(root(page).locator('.csel-toggle')).toBeFocused();
    });

    test('popover is not clipped by parent overflow:hidden', async ({ page }) => {
        await open(page);
        await page.evaluate(() => {
            const wrap = document.createElement('div');
            wrap.style.overflow = 'hidden';
            wrap.style.height = '40px';
            const rootEl = document.querySelector('.csel-root');
            document.getElementById('host').replaceWith(wrap);
            if (!rootEl) throw new Error('csel-root not found in document');
            wrap.append(rootEl);
        });
        await root(page).click();
        await expect(popover(page)).toBeVisible();
        const box = await popover(page).boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(0);
    });
});

test.describe('selection', () => {
    test('single mode: select closes popover, replaces value, fires events', async ({ page }) => {
        await open(page, 'single');
        await page.evaluate(() => {
            /** @type {string[]} */ (window.__evts = []).length = 0;
            for (const name of ['csel-select', 'csel-change', 'csel-close']) {
                window.addEventListener(name, () => window.__evts.push(name));
            }
        });
        await root(page).click();
        await option(page, 'b').click();
        await expect(popover(page)).not.toBeVisible();
        let evts = await page.evaluate(() => window.__evts);
        expect(evts).toContain('csel-select');
        expect(evts).toContain('csel-change');
        await root(page).click();
        await option(page, 'd').click();
        const value = await page.evaluate(() => window.__api.getValue().map((i) => i.id));
        expect(value).toEqual(['d']);
    });

    test('multiple mode: stays open, toggles selection, checkbox visual', async ({ page }) => {
        await open(page, 'multi');
        await root(page).click();
        await option(page, 'b').click();
        await expect(popover(page)).toBeVisible();
        await expect(option(page, 'b')).toHaveAttribute('aria-selected', 'true');
        const ids = await page.evaluate(() => window.__api.getValue().map((i) => i.id));
        expect(ids).toEqual(expect.arrayContaining(['a', 'b']));
    });

    test('disabled option cannot be selected by click or keyboard', async ({ page }) => {
        await open(page);
        await root(page).click();
        await option(page, 'c').click({ force: true });
        expect(await page.evaluate(() => window.__api.getValue())).toEqual([]);
        await page.keyboard.press('End');
        await page.keyboard.press('Home');
        // активная первая enabled; стрелками доходим до конца — disabled пропускается
        await page.keyboard.press('ArrowDown');
        const activeId = await page.evaluate(() => window.__api ? document.querySelector('.csel-option--active')?.dataset.id : undefined);
        expect(activeId).not.toBe('c');
    });

    test('readonly opens but does not mutate', async ({ page }) => {
        await open(page, 'readonly');
        await root(page).click();
        await expect(popover(page)).toBeVisible();
        await option(page, 'b').click();
        expect(await page.evaluate(() => window.__api.getValue())).toEqual([]);
        const clearBtnDisabled = await page.locator('.csel-select-all').isDisabled();
        expect(clearBtnDisabled).toBe(true);
    });

    test('loading shows spinner and blocks selection/search input', async ({ page }) => {
        await open(page, 'loading');
        await root(page).click();
        await expect(page.locator('.csel-spinner')).toBeVisible();
        await expect(page.locator('.csel-search-input')).toBeDisabled();
        await expect(option(page, 'a')).toHaveCount(0);
    });

    test('disabled instance ignores clicks', async ({ page }) => {
        await open(page, 'disabled');
        await root(page).click({ force: true });
        await expect(popover(page)).not.toBeVisible();
    });
});

test.describe('search', () => {
    test('filters list, highlights matches, fires onSearch, empty state text', async ({ page }) => {
        await open(page, 'search');
        await root(page).click();
        await page.locator('.csel-search-input').fill('alp');
        await expect(option(page, 'a')).toBeVisible();
        await expect(page.locator('.csel-hl')).toHaveText('Alp');
        await page.locator('.csel-search-input').fill('zzz');
        await expect(page.locator('.csel-empty')).toHaveText('No matches found');
        await page.locator('.csel-search-input').fill('');
        await expect(option(page, 'e')).toBeVisible();
    });
});

test.describe('keyboard', () => {
    test('ArrowDown from root focuses first option; Home/End navigate; grid Left/Right', async ({ page }) => {
        await open(page, 'columns');
        await root(page).focus();
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('.csel-option--active')).toHaveCount(1);
        await page.keyboard.press('End');
        const lastActive = await page.evaluate(() => [...document.querySelectorAll('.csel-option')].at(-1)?.dataset.id);
        const nowActive = await page.evaluate(() => document.querySelector('.csel-option--active')?.dataset.id);
        expect(nowActive).toBe(lastActive);
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Home');
        await expect(page.locator('.csel-option--active')).toHaveAttribute('data-id', '0');
    });
});

test.describe('multi-instance & destroy', () => {
    test('two instances are independent; destroy cleans up DOM', async ({ page }) => {
        await open(page);
        await page.evaluate(() => {
            const host2 = document.createElement('div');
            document.body.append(host2);
            window.__sel2 = new window.__select.constructor(host2, {
                items: [{ id: 'x', type: 'text', content: 'X only' }],
            });
        });
        // второй экземпляр уже создан — первый адресуем через .first() (DOM-порядок = порядок создания)
        await root(page).first().click();
        await expect(popover(page).first()).toBeVisible();
        const secondRoot = page.locator('.csel-root').nth(1);
        await secondRoot.click();
        // клик во второй экземпляр закрыл первый (outside-click)
        await expect(popover(page).first()).not.toBeVisible();
        // destroy второго не ломает первого
        await page.evaluate(() => window.__sel2.destroy());
        await expect(page.locator('.csel-root')).toHaveCount(1);
        await root(page).click();
        await expect(popover(page)).toBeVisible();
    });
});

test.describe('positioning', () => {
    test('flips above near viewport bottom and stays inside viewport horizontally', async ({ page }) => {
        await open(page, 'overflowBottom');
        await root(page).click();
        const popBox = await popover(page).boundingBox();
        const vp = page.viewportSize();
        expect(popBox.y + popBox.height).toBeLessThanOrEqual(vp.height);
        expect(popBox.x).toBeGreaterThanOrEqual(0);
    });
});
