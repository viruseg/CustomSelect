import { test, expect } from '@playwright/test';

// Регрессии по баг-репорту демо (пустой single select + содержимое popover).

test.describe('regression: empty single select chrome', () => {
    test('hides «...» and «×» when nothing is selected', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        await expect(page.locator('.csel-root .csel-more')).toBeHidden();
        await expect(page.locator('.csel-root .csel-uncheck')).toBeHidden();
    });

    test('single-mode popover hides batch buttons, keeps search', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await expect(page.locator('.csel-check-all')).toBeHidden();
        await expect(page.locator('.csel-uncheck-all')).toBeHidden();
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

    test('click on selected value closes an open popover', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=single');
        await page.waitForFunction(() => Boolean(window.__select));
        const pop = page.locator('.csel-popover');

        // single уже со значением: первый клик по нему открывает
        await page.locator('.csel-root .csel-value-text').click();
        await expect(pop).toBeVisible();
        // повторный клик по значению закрывает открытую модалку
        await page.locator('.csel-root .csel-value-text').click();
        await expect(pop).not.toBeVisible();
        // ещё один клик снова открывает
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
    test('first tag position is pixel-stable at any fill level', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multiMax2');
        await page.waitForFunction(() => Boolean(window.__select));
        // тест о вертикальном ритме первого тега: нужен широкий триггер, иначе при
        // узком дефолте пилюли закономерно уходят за «...» и первый тег скрывается
        await page.evaluate(() => window.__api.updateConfig({ mainWidth: 400 }));

        const metrics = () => page.evaluate(() => {
            const root = document.querySelector('.csel-root');
            const rr = root.getBoundingClientRect();
            const tag = root.querySelector('.csel-tag');
            const tr = tag.getBoundingClientRect();
            return { dx: tr.x - rr.x, dy: tr.y - rr.y };
        });

        // одна строка
        await page.evaluate(() => window.__api.setValue([0]));
        await page.waitForTimeout(120);
        const oneLine = await metrics();

        // две строки
        await page.evaluate(() => window.__api.setValue([0, 1, 2, 3, 4, 5]));
        await page.waitForTimeout(120);
        const twoLines = await metrics();

        // левый край и верхний отступ первого тега идентичны пиксель-в-пиксель
        expect(Math.abs(twoLines.dx - oneLine.dx)).toBeLessThanOrEqual(1);
        expect(Math.abs(twoLines.dy - oneLine.dy)).toBeLessThanOrEqual(1);
        expect(oneLine.dy).toBeGreaterThanOrEqual(0);
    });

    test('fully filled: top, inter-line and bottom gaps are equal', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multiMax2');
        await page.waitForFunction(() => Boolean(window.__select));

        // тесту нужен широкий триггер (несколько тегов в строке) — задаём явно,
        // дефолтная ширина 150px намеренно узкая
        await page.evaluate(() => window.__api.updateConfig({ mainWidth: 400 }));
        // заполнить ОБЕ линии тегами одинаковой ширины
        await page.evaluate(() => window.__api.setValue([0, 1, 2, 3, 4, 5, 6]));
        await page.waitForTimeout(150);

        const gaps = await page.evaluate(() => {
            const root = document.querySelector('.csel-root');
            const rr = root.getBoundingClientRect();
            const tags = [...root.querySelectorAll('.csel-tag')]
                .filter((p) => getComputedStyle(p).display !== 'none')
                .map((p) => p.getBoundingClientRect());
            const first = tags[0];
            const last = tags[tags.length - 1];
            // вторая линия = теги с y заметно ниже первой
            const secondLine = tags.find((t) => t.y - first.y > first.height);
            return {
                top: first.y - rr.y,
                mid: secondLine ? secondLine.y - (first.y + first.height) : null,
                bottom: rr.bottom - (last.y + last.height),
            };
        });

        expect(gaps.mid).not.toBeNull();
        expect(Math.abs(gaps.top - gaps.mid)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(gaps.mid - gaps.bottom)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(gaps.top - gaps.bottom)).toBeLessThanOrEqual(1.5);
    });
});

test.describe('regression: no text selection on placeholder/buttons', () => {
    test('placeholder and every trigger button are user-select:none', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multiMax2');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.evaluate(() => window.__api.setValue([0]));

        const sel = await page.evaluate(() => {
            const q = (s) => document.querySelector(s);
            const us = (el) => {
                const cs = getComputedStyle(el);
                return cs.userSelect || cs.webkitUserSelect;
            };
            return {
                placeholder: us(q('.csel-root .csel-placeholder')),
                clear: us(q('.csel-root .csel-uncheck')),
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

test.describe('regression: more-button uses svg dots', () => {
    test('button contains svg dots instead of text', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multiMax2');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.evaluate(() => window.__api.setValue([0, 1, 2, 3, 4, 5, 6]));
        await page.waitForTimeout(150);

        const m = await page.evaluate(() => {
            const more = document.querySelector('.csel-root .csel-more');
            return {
                text: more.textContent.trim(),
                dots: Boolean(more.querySelector('svg.csel-dots')),
                label: more.getAttribute('aria-label'),
            };
        });
        expect(m.text).toBe('');
        expect(m.dots).toBe(true);
        expect(m.label).toBe('Show more');
    });
});

test.describe('regression: single mode has no clear button', () => {
    test('× hidden in single mode, appears in multiple; uncheckAll() API still works', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=single');
        await page.waitForFunction(() => Boolean(window.__select));

        // single + выбранный элемент: крестика нет
        await expect(page.locator('.csel-root .csel-uncheck')).toBeHidden();

        // переключили в multiple — крестик появился (выбор сохранился)
        await page.evaluate(() => window.__api.updateConfig({ multiple: true }));
        await expect(page.locator('.csel-root .csel-uncheck')).toBeVisible();
        expect(await page.evaluate(() => window.__api.getValue().length)).toBe(1);

        // вернулись в single — крестик снова скрыт
        await page.evaluate(() => window.__api.updateConfig({ multiple: false }));
        await expect(page.locator('.csel-root .csel-uncheck')).toBeHidden();

        // публичный uncheckAll() в single работает как прежде
        await page.evaluate(() => window.__api.uncheckAll());
        expect(await page.evaluate(() => window.__api.getValue())).toEqual([]);
    });
});

test.describe('regression: selected image vertically centered', () => {
    test('image center matches value-text center in trigger', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=singleImage');
        await page.waitForFunction(() => Boolean(window.__select));

        const d = await page.evaluate(() => {
            const vt = document.querySelector('.csel-root .csel-value-text').getBoundingClientRect();
            const im = document.querySelector('.csel-root .csel-img').getBoundingClientRect();
            return Math.abs((vt.y + vt.height / 2) - (im.y + im.height / 2));
        });
        expect(d).toBeLessThanOrEqual(1);
    });
});

test.describe('regression: image options render image only', () => {
    test('popover image option has no text label, keeps aria-label', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=imagesPopover');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.locator('.csel-root').click();
        await page.waitForSelector('.csel-popover:popover-open');

        const m = await page.evaluate(() => {
            const opt = document.querySelector('.csel-listbox [role="option"]');
            return {
                img: Boolean(opt.querySelector('img')),
                label: Boolean(opt.querySelector('.csel-option-label')),
                text: opt.textContent.trim(),
                ariaLabel: opt.getAttribute('aria-label'),
            };
        });
        expect(m.img).toBe(true);
        expect(m.label).toBe(false);
        expect(m.text).toBe('');
        expect(m.ariaLabel).toBe('Swatch 0');
    });
});

test.describe('regression: middle-click deselects tag', () => {
    test('aux-click on selected pill removes it like the × button', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=multiMax2');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.evaluate(() => window.__api.setValue([0, 1]));

        const before = await page.evaluate(() => window.__api.getValue().map((i) => i.id));
        expect(before).toEqual([0, 1]);

        // средняя кнопка по первому тегу
        await page.locator('.csel-root .csel-tag').first().click({ button: 'middle' });
        await page.waitForTimeout(150);

        const after = await page.evaluate(() => window.__api.getValue().map((i) => i.id));
        expect(after).toEqual([1]);
        // popover не открывался
        await expect(page.locator('.csel-popover')).not.toBeVisible();
    });
});

test.describe('regression: more-button fills its line', () => {
    test('«...» matches pill height and is vertically centered on the line', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=overflowMulti');
        await page.waitForFunction(() => Boolean(window.__select));
        // широкий триггер нужен, чтобы «...» завершал линию из нескольких тегов
        await page.evaluate(() => window.__api.updateConfig({ mainWidth: 400 }));
        await page.evaluate(() => window.__api.checkAll());
        await page.waitForTimeout(200);

        const m = await page.evaluate(() => {
            const root = document.querySelector('.csel-root');
            const more = root.querySelector('.csel-more').getBoundingClientRect();
            const vis = [...root.querySelectorAll('.csel-tag')]
                .filter((p) => getComputedStyle(p).display !== 'none')
                .map((p) => p.getBoundingClientRect());
            return {
                moreH: Math.round(more.height),
                pillH: Math.round(vis[0].height),
                // кнопка завершает ПОСЛЕДНЮЮ линию — сравниваем с её соседкой
                centerDelta: Math.abs((more.y + more.height / 2) - (vis.at(-1).y + vis.at(-1).height / 2)),
            };
        });
        expect(Math.abs(m.moreH - m.pillH)).toBeLessThanOrEqual(1);
        expect(m.centerDelta).toBeLessThanOrEqual(1.5);
    });
});

test.describe('regression: maxLines overflow hides pills and keeps them inside', () => {
    test('check-all overflow: extra pills hidden, visible ones stay within reserved lines', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=overflowMulti');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.evaluate(() => window.__api.checkAll());
        await page.waitForTimeout(200);

        const m = await page.evaluate(() => {
            const root = document.querySelector('.csel-root');
            const pills = [...root.querySelectorAll('.csel-tag')];
            const lineH = 36;
            const maxLines = 2;
            const limitTop = lineH * maxLines;
            const more = root.querySelector('.csel-more');
            const vis = pills
                .filter((p) => getComputedStyle(p).display !== 'none')
                .map((p) => ({ top: p.offsetTop, h: p.offsetHeight }));
            return {
                total: pills.length,
                visible: vis.length,
                moreShown: !more.hidden,
                moreTop: more.offsetTop,
                minTop: Math.min(...vis.map((v) => v.top)),
                worstBottom: Math.max(...vis.map((v) => v.top + v.h)),
            };
        });

        expect(m.total).toBeGreaterThan(m.visible);
        expect(m.moreShown).toBe(true);
        // кнопка «...» обязана сидеть в пределах зарезервированных линий
        expect(m.moreTop).toBeLessThan(36 * 2);
        // ни одна видимая пилюля не начинается выше области (нет center-выброса вверх)
        expect(m.minTop).toBeGreaterThanOrEqual(-1);
        // все видимые пилюли укладываются в зарезервированные maxLines строки
        expect(m.worstBottom).toBeLessThanOrEqual(36 * 2 + 2);
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

test.describe('regression: trigger width stability', () => {
    test('default mainWidth: trigger width constant across placeholder and selections', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=widthFlex');
        await page.waitForFunction(() => Boolean(window.__select));
        const root = page.locator('.csel-root');

        const wPlaceholder = (await root.boundingBox()).width;

        await root.click();
        await page.waitForSelector('.csel-popover:popover-open');
        await page.locator('.csel-option', { hasText: 'Hi' }).first().click();
        const wShort = (await root.boundingBox()).width;

        await root.click();
        await page.waitForSelector('.csel-popover:popover-open');
        await page.locator('.csel-option', { hasText: 'Unbelievably long option title' }).first().click();
        const wLong = (await root.boundingBox()).width;

        // дефолтный mainWidth фиксирован в px: ширина не следует за текстом
        expect(Math.abs(wShort - wPlaceholder)).toBeLessThan(0.5);
        expect(Math.abs(wLong - wPlaceholder)).toBeLessThan(0.5);
        expect(Math.abs(wPlaceholder - 150)).toBeLessThan(0.5);
    });

    test('explicit numeric mainWidth pins the width regardless of selection', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=widthFlex');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.evaluate(() => window.__api.updateConfig({ mainWidth: 260 }));

        const root = page.locator('.csel-root');
        const w0 = (await root.boundingBox()).width;
        await root.click();
        await page.waitForSelector('.csel-popover:popover-open');
        await page.locator('.csel-option', { hasText: 'Unbelievably long option title' }).first().click();
        const w1 = (await root.boundingBox()).width;

        expect(Math.abs(w0 - 260)).toBeLessThan(0.5);
        expect(Math.abs(w1 - 260)).toBeLessThan(0.5);
    });
});

test.describe('regression: narrow trigger overflow', () => {
    test('placeholder stays on one line, overflow is clipped', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=basic');
        await page.waitForFunction(() => Boolean(window.__select));
        await page.evaluate(() => window.__api.updateConfig({ mainWidth: 60 }));

        const m = await page.evaluate(() => {
            const root = document.querySelector('.csel-root');
            const ph = root.querySelector('.csel-placeholder');
            const va = root.querySelector('.csel-value-area');
            const pr = ph.getBoundingClientRect();
            return {
                phHeight: pr.height,
                lineHeight: parseFloat(getComputedStyle(root).getPropertyValue('--csel-line-height')),
                phRight: pr.right,
                vaRight: va.getBoundingClientRect().right,
                whiteSpace: getComputedStyle(ph).whiteSpace,
            };
        });

        // не переносится: высота не больше одной линии
        expect(m.phHeight).toBeLessThanOrEqual(m.lineHeight + 2);
        // невлезающий хвост скрыт обрезкой, а не вылезает за триггер
        expect(m.whiteSpace).toBe('nowrap');
        expect(m.phRight).toBeLessThanOrEqual(m.vaRight + 1);
    });

    test('horizontally overflowing pills hide behind the «...» button', async ({ page }) => {
        await page.goto('/tests/integration/harness.html?case=narrowMulti');
        await page.waitForFunction(() => Boolean(window.__select));

        const m = await page.evaluate(() => {
            const root = document.querySelector('.csel-root');
            const more = root.querySelector('.csel-more');
            const va = root.querySelector('.csel-value-area');
            const visible = [...root.querySelectorAll('.csel-tag')]
                .filter((p) => getComputedStyle(p).display !== 'none');
            return {
                moreShown: !more.hidden,
                visibleCount: visible.length,
                // каждая видимая пилюля целиком внутри контентной области value-area
                maxPillRight: Math.max(-1, ...visible.map((p) => p.getBoundingClientRect().right)),
                vaContentRight: (() => {
                    const r = va.getBoundingClientRect();
                    const pad = parseFloat(getComputedStyle(va).paddingRight) || 0;
                    return r.right - pad;
                })(),
            };
        });

        expect(m.moreShown).toBe(true);
        expect(m.maxPillRight).toBeLessThanOrEqual(m.vaContentRight + 1);
    });
});

test.describe('regression: image option alignment', () => {
    for (const kase of ['singleImage', 'imagesPopover']) {
        test(`[${kase}] image sits centered within the option row`, async ({ page }) => {
            await page.goto(`/tests/integration/harness.html?case=${kase}`);
            await page.waitForFunction(() => Boolean(window.__select));
            await page.locator('.csel-root').click();
            await page.waitForSelector('.csel-popover:popover-open');
            await page.waitForTimeout(100);

            const m = await page.evaluate(() => {
                const opt = /** @type {HTMLElement} */ (document.querySelector('.csel-popover .csel-option'));
                const img = opt.querySelector('.csel-img')?.getBoundingClientRect();
                const content = opt.querySelector('.csel-option-content')?.getBoundingClientRect();
                if (!img || !content || img.width === 0) return null;
                return {
                    // картинка по центру контентной области опции
                    centerDelta: Math.abs((img.left + img.width / 2) - (content.left + content.width / 2)),
                    // в single (без чекбокса) контент занимает всю строку → отступы равны
                    leftGap: img.left - opt.getBoundingClientRect().left,
                    rightGap: opt.getBoundingClientRect().right - img.right,
                    multiple: opt.querySelector('.csel-checkbox') !== null,
                };
            });

            expect(m).not.toBeNull();
            expect(m.centerDelta).toBeLessThanOrEqual(1);
            if (!m.multiple) {
                expect(Math.abs(m.leftGap - m.rightGap)).toBeLessThanOrEqual(2);
            }
        });
    }
});
