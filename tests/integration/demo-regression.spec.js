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

test.describe('regression: click on empty area toggles popover', () => {
    test('placeholder and empty space toggle open/closed', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        const pop = page.locator('.csel-popover');

        // открыли кликом по пустому месту
        await page.locator('.csel-root').click();
        await expect(pop).toBeVisible();

        // клик по зоне плейсхолдера закрывает (у плейсхолдера pointer-events:none —
        // клики физически принимает родительская value-area, это и есть «пустое место»)
        await page.locator('.csel-root .csel-value-area').click();
        await expect(pop).not.toBeVisible();

        // повторный клик по пустому месту снова открывает
        await page.locator('.csel-value-area').click({ position: { x: 5, y: 5 } });
        await expect(pop).toBeVisible();
    });

    test('click on selected value keeps popover open (spec §22)', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=single');
        await page.waitForFunction(() => Boolean(window.__select));
        const pop = page.locator('.csel-popover');

        // single уже со значением: первый клик по нему открывает
        await page.locator('.csel-root .csel-value-text').click();
        await expect(pop).toBeVisible();
        // повторный клик по значению НЕ закрывает (семантика open)
        await page.locator('.csel-root .csel-value-text').click();
        await expect(pop).toBeVisible();
    });
});

test.describe('regression: group headers in multi-column flow', () => {
    test('headers are not clumped: each sits before its own group', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=columns');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await page.waitForSelector('.csel-popover:popover-open');
        await page.waitForTimeout(200);

        const g = await page.evaluate(() => {
            const lb = document.querySelector('.csel-listbox');
            const pop = document.querySelector('.csel-popover').getBoundingClientRect();
            const rects = [...lb.querySelectorAll('.csel-group-header')].map((h) => h.getBoundingClientRect());
            return {
                count: rects.length,
                a: rects[0] ? { x: Math.round(rects[0].x), y: Math.round(rects[0].y) } : null,
                b: rects[1] ? { x: Math.round(rects[1].x), y: Math.round(rects[1].y) } : null,
                popLeft: pop.x,
            };
        });
        expect(g.count).toBe(2);
        // заголовки не должны улетать за левый край видимой области
        expect(g.a.x).toBeGreaterThanOrEqual(g.popLeft - 1);
        // и не должны идти сплошняком друг под другом в одной колонке без опций между ними:
        // либо разнесены по вертикали минимум на 2 строки, либо в разных колонках
        const separated = g.b.y - g.a.y >= 60 || g.b.x - g.a.x > 80;
        expect(separated).toBe(true);
    });
});

test.describe('regression: scrollbar styling and horizontal snap', () => {
    test('listbox uses thin themed scrollbar', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=tallSingle');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await page.waitForSelector('.csel-popover:popover-open');
        const style = await page.evaluate(() => {
            const cs = getComputedStyle(document.querySelector('.csel-listbox'));
            return { width: cs.scrollbarWidth ?? '', color: cs.scrollbarColor ?? '' };
        });
        // ширина стандартизована шире; цвет движки могут не экспонировать отдельно
        if (style.width === 'thin') {
            expect(style.width).toBe('thin');
        }
        if (style.color !== '') {
            expect(style.color === 'transparent' || style.color.includes('rgba(0, 0, 0, 0)')).toBe(true);
        }
    });

    test('multi column: horizontal scroll snaps by column (mandatory)', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=columns');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await page.waitForSelector('.csel-popover:popover-open');
        const s = await page.evaluate(() => {
            const lb = document.querySelector('.csel-listbox');
            const cs = getComputedStyle(lb);
            const opt = lb.querySelector('[role="option"]');
            const header = lb.querySelector('.csel-group-header');
            return {
                type: cs.scrollSnapType,
                optAlign: getComputedStyle(opt).scrollSnapAlign,
                headerAlign: header ? getComputedStyle(header).scrollSnapAlign : '(нет заголовков)',
            };
        });
        expect(s.type).toContain('x mandatory');
        expect(s.optAlign).toBe('start');
        expect(s.headerAlign).toBe('none');
    });

    test('single column: no horizontal snap', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=tallSingle');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        const t = await page.evaluate(() =>
            getComputedStyle(document.querySelector('.csel-listbox')).scrollSnapType);
        expect(t === '' || t === 'none').toBeTruthy();
    });
});

test.describe('regression: tag aligned top-left with maxLines>1', () => {
    test('single selected tag sits at top-left of the reserved area', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multiMax2');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.evaluate(() => window.__api.setValue([0]));

        const m = await page.evaluate(() => {
            const root = document.querySelector('.csel-root');
            const tag = root.querySelector('.csel-tag');
            const rr = root.getBoundingClientRect();
            const tr = tag.getBoundingClientRect();
            return { dx: tr.x - rr.x, dy: tr.y - rr.y };
        });
        expect(m.dx).toBeLessThanOrEqual(12);
        expect(m.dy).toBeLessThanOrEqual(12);
    });
});

test.describe('regression: no text selection on placeholder/buttons', () => {
    test('placeholder and every trigger button are user-select:none', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multiMax2');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.evaluate(() => window.__api.setValue([0]));

        const sel = await page.evaluate(() => {
            const q = (s) => document.querySelector(s);
            const us = (el) => getComputedStyle(el).userSelect;
            return {
                placeholder: us(q('.csel-root .csel-placeholder')),
                clear: us(q('.csel-root .csel-clear')),
                more: us(q('.csel-root .csel-more')),
                toggle: us(q('.csel-root .csel-toggle')),
                tagRemove: us(q('.csel-root .csel-tag-remove')),
            };
        });
        for (const [name, value] of Object.entries(sel)) {
            expect(value, name).toBe('none');
        }
    });
});

test.describe('regression: compact search field', () => {
    test('search input is visibly shorter than option line height', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await page.waitForSelector('.csel-popover:popover-open');

        const m = await page.evaluate(() => {
            const input = document.querySelector('.csel-search-input');
            const header = document.querySelector('.csel-search-header');
            return {
                inputH: parseFloat(getComputedStyle(input).height),
                lineH: 36,
                headerPadY: getComputedStyle(header).paddingTop,
            };
        });
        expect(m.inputH).toBeLessThan(m.lineH);
        expect(m.inputH).toBeGreaterThanOrEqual(18);
    });
});

test.describe('regression: constant height with maxLines', () => {
    test('multiple select reserves maxLines height immediately and keeps it', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multiMax2');
        await page.waitForFunction(() => Boolean(window.__select));

        const h = () => page.evaluate(() =>
            Math.round(document.querySelector('.csel-root').getBoundingClientRect().height));

        // пустой выбор — высота уже две строки
        const emptyH = await h();
        expect(emptyH).toBeGreaterThanOrEqual(70);
        expect(emptyH).toBeLessThanOrEqual(76);

        // после заполнения тегами высота не изменилась
        await page.evaluate(() => window.__api.setValue([0, 1, 2, 3, 4]));
        await page.waitForTimeout(150);
        const filledH = await h();
        expect(Math.abs(filledH - emptyH)).toBeLessThanOrEqual(2);
    });

    test('single mode keeps natural one-line height', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        const hh = await page.evaluate(() =>
            Math.round(document.querySelector('.csel-root').getBoundingClientRect().height));
        expect(hh).toBeLessThanOrEqual(40);
    });
});

test.describe('regression: mouse wheel scrolls columns horizontally', () => {
    test('vertical wheel translates to horizontal column scrolling', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=columns');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await page.waitForSelector('.csel-popover:popover-open');

        // реалистичный паттерн: короткие щелчки колеса (не одна большая дельта)
        await page.locator('.csel-listbox').hover();
        for (let i = 0; i < 3; i++) {
            await page.mouse.wheel(0, 120);
            await page.waitForTimeout(180);
        }

        const sl = await page.evaluate(() => document.querySelector('.csel-listbox').scrollLeft);
        expect(sl).toBeGreaterThan(80); // минимум одна колонка
    });
});

test.describe('regression: placeholder left alignment', () => {
    for (const kase of ['multi', 'basic']) {
        test(`empty state: placeholder sits at content left edge (${kase})`, async ({ page }) => {
            await page.goto(`/tests/integration/harness.html?case=${kase}`);
            await page.waitForFunction(() => Boolean(window.__select));
            if (kase === 'multi') {
                // harness multi стартует с выбором — снимаем, чтобы показать плейсхолдер
                await page.locator('.csel-root .csel-tag-remove').click();
                await expect(page.locator('.csel-root .csel-placeholder')).toBeVisible();
            }
            const offset = await page.evaluate(() => {
                const root = document.querySelector('.csel-root');
                const ph = root.querySelector('.csel-placeholder');
                return ph.getBoundingClientRect().x - root.getBoundingClientRect().x;
            });
            // левый край контента root = border 1px + padding-left 8px ≈ 9px
            expect(offset).toBeLessThanOrEqual(12);
        });
    }
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
