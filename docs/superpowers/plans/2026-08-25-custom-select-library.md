# Custom Select Component Library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zero-dependency ESM-библиотека кастомного select на Popover API с поиском (4 режима), группами, мультивыбором, клавиатурной навигацией, proximity-close и реактивным конфигом.

**Architecture:** Facade `CustomSelect` оркестрирует независимые модули: ConfigManager (defaults/валидация), StateManager (items/selection, без DOM), SearchEngine (чистая фильтрация), DomRenderer (только DOM), PositionEngine (чистая геометрия над rect), ProximityEngine (pointermove→RAF→AABB c arming), KeyboardNav (intent-based), EventEmitter (последовательные async handlers). Popover — `<div popover="manual">`, смонтированный в `document.body`.

**Tech Stack:** Vanilla ES2022, JSDoc + TS `checkJs`, Vite (lib/ESM), Vitest (unit), Playwright (integration), vite-plugin-dts.

**Spec:** `docs/superpowers/specs/2026-08-25-custom-select-design.md` — план аргументируется от спеки; исполнители читают оба документа.

## Global Constraints

- Минимальные браузеры: Chrome 151+, Firefox 154+, Safari 26+. Без полифиллов и legacy-транспиляции.
- Runtime dependencies: **0**. Dev deps только: vite, typescript, vitest, @playwright/test, vite-plugin-dts.
- Distribution: только ESM → `dist/index.js`, `dist/index.css`, `dist/index.d.ts`.
- **Все приватные члены всех классов (поля и методы) объявляются только через `#`.** Публичны только методы из спеки §63. `_prefix` запрещён.
- Пользовательский контент никогда не проходит через `innerHTML` — только `createElement`/`createTextNode`/`append`.
- Классы CSS — префикс `csel-`; переменные — `--csel-*`.
- `id`: `string | number`; `1` и `"1"` различаются (нативная семантика `Set`/`Map`).
- Ошибки: `TypeError` — неверные аргументы; `Error` — lifecycle misuse / неизвестные id; `DOMException(msg,'NotSupportedError')` — нет Popover API. Сообщение содержит имя поля, не сам конфиг.
- Все пользовательские колбэки awaited; исключения логируются в `console.error`, состояние не откатывается.
- Работаем напрямую в `master`, коммит после каждой задачи.
- Node >= 22.

---

### Task 1: Project setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `.gitignore`, `src/index.js`, `index.html`, `tests/unit/smoke.test.js`

**Interfaces:**
- Produces: скрипты `dev` (порт 5173), `build`, `typecheck`, `test:unit`, `test:e2e`; структура каталогов для последующих задач.

- [ ] **Step 1: package.json**

```json
{
    "name": "custom-select",
    "version": "0.1.0",
    "description": "Zero-dependency custom select built on the HTML Popover API",
    "type": "module",
    "private": true,
    "engines": { "node": ">=22" },
    "main": "./dist/index.js",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
        "./index.css": "./dist/index.css"
    },
    "files": ["dist"],
    "sideEffects": ["*.css"],
    "scripts": {
        "dev": "vite --port 5173 --strictPort",
        "build": "vite build",
        "typecheck": "tsc --noEmit",
        "test:unit": "vitest run",
        "test:e2e": "playwright test"
    },
    "devDependencies": {
        "@playwright/test": "^1.55.0",
        "typescript": "^5.9.0",
        "vite": "^7.0.0",
        "vite-plugin-dts": "^4.5.0",
        "vitest": "^3.2.0"
    }
}
```

- [ ] **Step 2: tsconfig.json (спека §3)**

```json
{
    "compilerOptions": {
        "allowJs": true,
        "checkJs": true,
        "noEmit": true,
        "target": "ESNext",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "strict": true,
        "noImplicitAny": true,
        "noUncheckedIndexedAccess": true,
        "lib": ["ESNext", "DOM", "DOM.Iterable"]
    },
    "include": ["src/**/*.js"]
}
```

- [ ] **Step 3: vite.config.js**

```js
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        dts({
            entryRoot: 'src',
            include: ['src/**/*.js'],
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: 'src/index.js',
            formats: ['es'],
            fileName: 'index',
        },
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                assetFileNames: (assetInfo) =>
                    assetInfo.names?.[0]?.endsWith('.css') ? 'index.css' : '[name][extname]',
            },
        },
    },
});
```

- [ ] **Step 4: vitest.config.js**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/unit/**/*.test.js'],
        environment: 'node',
    },
});
```

- [ ] **Step 5: playwright.config.js**

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'tests/integration',
    timeout: 15000,
    use: { baseURL: 'http://localhost:5173' },
    webServer: {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
        { name: 'firefox', use: { browserName: 'firefox' } },
        { name: 'webkit', use: { browserName: 'webkit' } },
    ],
});
```

- [ ] **Step 6: .gitignore, src/index.js (каркас), smoke-тест, index.html**

```gitignore
node_modules/
dist/
test-results/
playwright-report/
```

```js
// src/index.js — расширяется в Task 17
export const VERSION = '0.1.0';
```

```js
import { describe, it, expect } from 'vitest';
import { VERSION } from '../../src/index.js';

describe('smoke', () => {
    it('exposes version', () => {
        expect(VERSION).toBe('0.1.0');
    });
});
```

```html
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>CustomSelect demo</title>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/demo/main.js"></script>
</body>
</html>
```

Также создать пустой `src/styles/index.css` со строкой `@import './variables.css';` и пустыми `variables.css`, `main-module.css`, `modal-module.css`, `animations.css` (заполняются в Task 13) — чтобы build находил импорты уже на этом этапе.

- [ ] **Step 7: Установка и гейты**

Run: `npm install && npx playwright install chromium firefox webkit && npm run build && npm run typecheck && npm run test:unit`
Expected: все команды успешны.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: project setup (vite, checkJs, vitest, playwright)"
```

---

### Task 2: types.js — все JSDoc typedef

**Files:**
- Modify: `src/types.js`

**Interfaces:**
- Produces: typedefs `ItemContentType`, `CustomSelectItem`, `SearchMode`, `CustomSelectConfig`, `SelectEvents`, `OpenState`, `InternalState`, `SimpleRect`, `Point`, `PlacementResult` — точные поля см. спека §4–§10. Все модули импортируют типы через `@typedef {import('../types.js').X}`.

- [ ] **Step 1: Записать typedefs**

Скопировать все JSDoc-определения из спеки §4.1, §4.2, §5, §13, §10 дословно, плюс:

```js
/**
 * @typedef {Object} SimpleRect
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} PlacementResult
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 * @property {boolean} below
 */

/** @typedef {{name: string|null, items: import('./types.js').CustomSelectItem[]}} ItemGroup */

export {};
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/types.js && git commit -m "feat: JSDoc typedefs"
```

---

### Task 3: InstanceId

**Files:**
- Create: `src/core/InstanceId.js`
- Test: `tests/unit/InstanceId.test.js`

**Interfaces:**
- Produces: `nextInstanceId(): string` — монотонный генератор `csel-N`.

- [ ] **Step 1: Падающий тест**

```js
import { describe, it, expect } from 'vitest';
import { nextInstanceId } from '../../src/core/InstanceId.js';

describe('nextInstanceId', () => {
    it('generates monotonically increasing ids', () => {
        const a = nextInstanceId();
        const b = nextInstanceId();
        expect(a).toMatch(/^csel-\d+$/);
        expect(Number(b.slice(5))).toBe(Number(a.slice(5)) + 1);
    });

    it('never repeats within many calls', () => {
        const seen = new Set(Array.from({ length: 100 }, () => nextInstanceId()));
        expect(seen.size).toBe(100);
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация**

```js
let counter = 0;

/** @returns {string} уникальный монотонный идентификатор экземпляра */
export function nextInstanceId() {
    counter += 1;
    return `csel-${counter}`;
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/InstanceId.js tests/unit/InstanceId.test.js && git commit -m "feat: instance id generator"
```

---

### Task 4: EventEmitter

**Files:**
- Create: `src/core/EventEmitter.js`
- Test: `tests/unit/EventEmitter.test.js`

**Interfaces:**
- Produces: класс с `on(event, handler)`, `off(event, handler)`, `async emit(event, ...args): Promise<void>`. Повторный `on` того же handler — no-op. Ошибки handler'ов логируются в `console.error` и не прерывают остальных; `emit` резолвится после ВСЕХ handlers (включая async).

- [ ] **Step 1: Падающие тесты**

```js
import { describe, it, expect, vi } from 'vitest';
import EventEmitter from '../../src/core/EventEmitter.js';

describe('EventEmitter', () => {
    it('calls handlers in registration order', async () => {
        const em = new EventEmitter();
        const order = [];
        em.on('x', () => order.push(1));
        em.on('x', () => order.push(2));
        await em.emit('x');
        expect(order).toEqual([1, 2]);
    });

    it('awaits async handlers sequentially', async () => {
        const em = new EventEmitter();
        const order = [];
        em.on('x', async () => {
            await new Promise((r) => setTimeout(r, 20));
            order.push('slow-first');
        });
        em.on('x', () => order.push('fast-second'));
        await em.emit('x');
        expect(order).toEqual(['slow-first', 'fast-second']);
    });

    it('ignores duplicate registration of same handler', async () => {
        const em = new EventEmitter();
        const h = vi.fn();
        em.on('x', h);
        em.on('x', h);
        await em.emit('x');
        expect(h).toHaveBeenCalledTimes(1);
    });

    it('off removes handler', async () => {
        const em = new EventEmitter();
        const h = vi.fn();
        em.on('x', h);
        em.off('x', h);
        await em.emit('x');
        expect(h).not.toHaveBeenCalled();
    });

    it('continues after sync handler error and logs once', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const em = new EventEmitter();
        const good = vi.fn();
        em.on('x', () => { throw new Error('boom'); });
        em.on('x', good);
        await expect(em.emit('x')).resolves.toBeUndefined();
        expect(good).toHaveBeenCalledTimes(1);
        expect(errSpy).toHaveBeenCalledTimes(1);
        errSpy.mockRestore();
    });

    it('awaits errored async handler before continuing others', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const em = new EventEmitter();
        const order = [];
        em.on('x', async () => {
            await new Promise((r) => setTimeout(r, 10));
            throw new Error('late boom');
        });
        em.on('x', () => order.push('after'));
        await em.emit('x');
        expect(order).toEqual(['after']);
        errSpy.mockRestore();
    });

    it('rejects non-function handler', () => {
        const em = new EventEmitter();
        expect(() => em.on('x', /** @type {any} */ (null))).toThrow(TypeError);
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация**

```js
export default class EventEmitter {
    /** @type {Map<string, Set<Function>>} */
    #handlers = new Map();

    /**
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
        if (typeof handler !== 'function') {
            throw new TypeError(`Invalid handler for event "${event}": expected function.`);
        }
        let set = this.#handlers.get(event);
        if (!set) {
            set = new Set();
            this.#handlers.set(event, set);
        }
        set.add(handler);
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
        this.#handlers.get(event)?.delete(handler);
    }

    /**
     * Последовательное выполнение; ошибки изолируются.
     * @param {string} event
     * @param {...unknown} args
     * @returns {Promise<void>}
     */
    async emit(event, ...args) {
        const set = this.#handlers.get(event);
        if (!set || set.size === 0) return;
        for (const handler of [...set]) {
            try {
                await handler(...args);
            } catch (error) {
                console.error(`[CustomSelect] Event handler failed for "${event}"`, error);
            }
        }
    }
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/EventEmitter.js tests/unit/EventEmitter.test.js && git commit -m "feat: async sequential EventEmitter"
```

---

### Task 5: ConfigManager + validateItems

**Files:**
- Create: `src/core/ConfigManager.js`
- Test: `tests/unit/ConfigManager.test.js`

**Interfaces:**
- Produces:
  - `DEFAULT_CONFIG` — полные дефолты из спеки §5 (замороженный объект);
  - `validateItems(items): CustomSelectItem[]` — бросает `TypeError` при не-массиве, невалидном item (id/type/content/searchKeywords/disabled/group/ariaLabel), дубликате id; различает `1` vs `"1"`;
  - `default class ConfigManager` — `constructor(patch?)`, `get config()` (всегда полный), `update(patch)`. Валидация: числовые поля (`maxLines>=1, lineHeight>=1, modalMaxHeight>=1, modalOffset>=0, columns>=1, columnGap>=0, cursorDistanceThreshold>=0`, NaN/Infinity → TypeError с именем поля), булевы поля, `searchMode ∈ {contains,startsWith,exact,fuzzy}`, строковые/число-или-строка поля (`placeholder, emptySearchText, emptyListText, mainWidth, modalWidth`). Неизвестные ключи игнорируются. Поля `items`/`selectedIds` НЕ обрабатываются здесь (фасад ведёт их через StateManager).

- [ ] **Step 1: Падающие тесты**

```js
import { describe, it, expect } from 'vitest';
import ConfigManager, { DEFAULT_CONFIG, validateItems } from '../../src/core/ConfigManager.js';

describe('DEFAULT_CONFIG', () => {
    it('matches spec defaults', () => {
        expect(DEFAULT_CONFIG.multiple).toBe(false);
        expect(DEFAULT_CONFIG.placeholder).toBe('Выберите значение...');
        expect(DEFAULT_CONFIG.lineHeight).toBe(36);
        expect(DEFAULT_CONFIG.modalMaxHeight).toBe(320);
        expect(DEFAULT_CONFIG.modalOffset).toBe(4);
        expect(DEFAULT_CONFIG.columns).toBe(1);
        expect(DEFAULT_CONFIG.columnGap).toBe(8);
        expect(DEFAULT_CONFIG.searchMode).toBe('contains');
        expect(DEFAULT_CONFIG.cursorDistanceThreshold).toBe(150);
        expect(DEFAULT_CONFIG.animations).toBe(true);
        expect(DEFAULT_CONFIG.showSelectedItems).toBe(true);
        expect(DEFAULT_CONFIG.highlightSearchMatches).toBe(false);
    });
});

describe('validateItems', () => {
    it('accepts valid items and returns same array', () => {
        const items = [{ id: 1, type: 'text', content: 'A' }];
        expect(validateItems(items)).toBe(items);
    });

    it('rejects non-array', () => {
        expect(() => validateItems('nope')).toThrow(TypeError);
    });

    it('rejects invalid fields', () => {
        expect(() => validateItems([{ id: 1, type: 'text' }])).toThrow(/content/);
        expect(() => validateItems([{ id: 1, type: 'video', content: 'x' }])).toThrow(/type/);
        expect(() => validateItems([{ type: 'text', content: 'x' }])).toThrow(/id/);
        expect(() => validateItems([{ id: 1, type: 'text', content: 'x', searchKeywords: 'a' }])).toThrow(/searchKeywords/);
    });

    it('distinguishes 1 vs "1"; catches true duplicates', () => {
        const mixed = [
            { id: 1, type: 'text', content: 'a' },
            { id: '1', type: 'text', content: 'b' },
        ];
        expect(() => validateItems(mixed)).not.toThrow();
        expect(() => validateItems([
            { id: 1, type: 'text', content: 'a' },
            { id: 1, type: 'text', content: 'b' },
        ])).toThrow(/duplicate/i);
    });
});

describe('ConfigManager', () => {
    it('fills defaults from partial patch', () => {
        const cm = new ConfigManager({ items: [] });
        expect(cm.config.searchable).toBe(true);
        expect(cm.config.mainWidth).toBe('100%');
    });

    it('partial update keeps untouched values', () => {
        const cm = new ConfigManager({ items: [], columns: 3 });
        cm.update({ searchable: false });
        expect(cm.config.columns).toBe(3);
        expect(cm.config.searchable).toBe(false);
    });

    it.each([
        [{ columns: 0 }, /columns/],
        [{ maxLines: 0 }, /maxLines/],
        [{ lineHeight: 0 }, /lineHeight/],
        [{ modalMaxHeight: -5 }, /modalMaxHeight/],
        [{ columnGap: -1 }, /columnGap/],
        [{ cursorDistanceThreshold: NaN }, /cursorDistanceThreshold/],
        [{ modalOffset: Infinity }, /modalOffset/],
        [{ searchMode: 'regex' }, /searchMode/],
        [{ disabled: 'yes' }, /disabled/],
    ])('rejects %j', (patch, rx) => {
        const cm = new ConfigManager({ items: [] });
        expect(() => cm.update(patch)).toThrow(rx);
        expect(() => new ConfigManager({ items: [], ...patch })).toThrow(rx);
    });

    it('ignores unknown properties', () => {
        const cm = new ConfigManager({ items: [] });
        cm.update({ nonsense: 42 });
        expect(cm.config.nonsense).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация**

```js
/**
 * @typedef {import('../types.js').CustomSelectConfig} CustomSelectConfig
 * @typedef {import('../types.js').CustomSelectItem} CustomSelectItem
 */

const NUMERIC_RULES = /** @type {const} */ ({
    maxLines: { min: 1 },
    lineHeight: { min: 1 },
    modalMaxHeight: { min: 1 },
    modalOffset: { min: 0 },
    columns: { min: 1 },
    columnGap: { min: 0 },
    cursorDistanceThreshold: { min: 0 },
});

const BOOLEAN_FIELDS = ['multiple', 'searchable', 'searchCaseSensitive', 'showClearAll',
    'showSelectAll', 'disabled', 'readonly', 'loading', 'animations',
    'showSelectedItems', 'highlightSearchMatches'];

const SEARCH_MODES = new Set(['contains', 'startsWith', 'exact', 'fuzzy']);

/** @returns {CustomSelectConfig} */
function buildDefaults() {
    return {
        items: [],
        selectedIds: [],
        multiple: false,
        placeholder: 'Выберите значение...',
        maxLines: 1,
        lineHeight: 36,
        mainWidth: '100%',
        modalWidth: 'auto',
        modalMaxHeight: 320,
        modalOffset: 4,
        columns: 1,
        columnGap: 8,
        searchable: true,
        searchMode: 'contains',
        searchCaseSensitive: false,
        emptySearchText: 'Ничего не найдено',
        emptyListText: 'Нет доступных элементов',
        showClearAll: true,
        showSelectAll: false,
        disabled: false,
        readonly: false,
        loading: false,
        animations: true,
        cursorDistanceThreshold: 150,
        showSelectedItems: true,
        highlightSearchMatches: false,
    };
}

export const DEFAULT_CONFIG = Object.freeze(buildDefaults());

/**
 * @param {string} field
 * @param {unknown} value
 * @param {{min: number}} rule
 */
function checkNumeric(field, value, rule) {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`Invalid CustomSelectConfig.${field}: expected finite number, got ${String(value)}.`);
    }
    if (value < rule.min) {
        throw new TypeError(`Invalid CustomSelectConfig.${field}: expected number >= ${rule.min}, got ${value}.`);
    }
}

/**
 * @param {string} field
 * @param {unknown} value
 */
function checkBoolean(field, value) {
    if (typeof value !== 'boolean') {
        throw new TypeError(`Invalid CustomSelectConfig.${field}: expected boolean.`);
    }
}

/**
 * Валидирует массив items; возвращает его же или бросает TypeError.
 * @param {unknown} items
 * @returns {CustomSelectItem[]}
 */
export function validateItems(items) {
    if (!Array.isArray(items)) {
        throw new TypeError('Invalid CustomSelectConfig.items: expected array.');
    }
    /** @type {Set<string|number>} */
    const seen = new Set();
    for (const item of items) {
        if (typeof item !== 'object' || item === null) {
            throw new TypeError('Invalid items entry: expected object.');
        }
        const rec = /** @type {Record<string, unknown>} */ (item);
        const id = rec['id'];
        if (typeof id !== 'string' && typeof id !== 'number') {
            throw new TypeError('Invalid item.id: expected string or number.');
        }
        if (rec['type'] !== 'text' && rec['type'] !== 'image') {
            throw new TypeError(`Invalid item.type for id ${String(id)}: expected "text" or "image".`);
        }
        if (typeof rec['content'] !== 'string') {
            throw new TypeError(`Invalid item.content for id ${String(id)}: expected string.`);
        }
        if (seen.has(id)) {
            throw new TypeError(`Duplicate item id detected: ${String(id)}.`);
        }
        seen.add(id);
        const kw = rec['searchKeywords'];
        if (kw !== undefined && (!Array.isArray(kw) || kw.some((k) => typeof k !== 'string'))) {
            throw new TypeError(`Invalid item.searchKeywords for id ${String(id)}: expected string[].`);
        }
        const dis = rec['disabled'];
        if (dis !== undefined && typeof dis !== 'boolean') {
            throw new TypeError(`Invalid item.disabled for id ${String(id)}.`);
        }
        for (const strField of ['group', 'ariaLabel']) {
            const v = rec[strField];
            if (v !== undefined && typeof v !== 'string') {
                throw new TypeError(`Invalid item.${strField} for id ${String(id)}.`);
            }
        }
    }
    return /** @type {CustomSelectItem[]} */ (items);
}

/**
 * @param {Partial<CustomSelectConfig>} patch
 * @param {CustomSelectConfig} base
 * @returns {CustomSelectConfig}
 */
function mergeValidated(patch, base) {
    if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
        throw new TypeError('Invalid CustomSelectConfig: expected object.');
    }
    /** @type {CustomSelectConfig} */
    const next = { ...base };
    const rec = /** @type {Record<string, unknown>} */ (patch);

    for (const field of Object.keys(NUMERIC_RULES)) {
        if (rec[field] !== undefined) checkNumeric(field, rec[field], NUMERIC_RULES[field]);
    }
    for (const field of BOOLEAN_FIELDS) {
        if (rec[field] !== undefined) checkBoolean(field, rec[field]);
    }
    if (rec['searchMode'] !== undefined && !SEARCH_MODES.has(/** @type {string} */ (rec['searchMode']))) {
        throw new TypeError(`Invalid CustomSelectConfig.searchMode: ${JSON.stringify(rec['searchMode'])}.`);
    }
    for (const field of ['placeholder', 'emptySearchText', 'emptyListText']) {
        if (rec[field] !== undefined && typeof rec[field] !== 'string') {
            throw new TypeError(`Invalid CustomSelectConfig.${field}: expected string.`);
        }
    }
    for (const field of ['mainWidth', 'modalWidth']) {
        const v = rec[field];
        if (v !== undefined && typeof v !== 'number' && typeof v !== 'string') {
            throw new TypeError(`Invalid CustomSelectConfig.${field}: expected number or string.`);
        }
    }

    for (const key of Object.keys(rec)) {
        if (key === 'items' || key === 'selectedIds') continue;
        if (key in DEFAULT_CONFIG) {
            next[key] = /** @type {any} */ (rec[key]);
        }
    }
    return next;
}

export default class ConfigManager {
    /** @type {CustomSelectConfig} */
    #current;

    /** @param {Partial<CustomSelectConfig>} [patch] */
    constructor(patch = {}) {
        this.#current = mergeValidated(patch, DEFAULT_CONFIG);
    }

    /** @returns {CustomSelectConfig} */
    get config() {
        return this.#current;
    }

    /**
     * @param {Partial<CustomSelectConfig>} patch
     * @returns {CustomSelectConfig}
     */
    update(patch) {
        this.#current = mergeValidated(patch, this.#current);
        return this.#current;
    }
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/ConfigManager.js tests/unit/ConfigManager.test.js && git commit -m "feat: ConfigManager with strict validation"
```

---

### Task 6: StateManager

**Files:**
- Create: `src/core/StateManager.js`
- Test: `tests/unit/StateManager.test.js`

**Interfaces:**
- Consumes: `validateItems` из ConfigManager.
- Produces: `default class StateManager`:
  - `constructor({ items, selectedIds?, multiple? })` — строгая валидация selectedIds (неизвестный → `Error`; >1 при single → `TypeError`; disabled разрешены);
  - `select(id)` — бросает на неизвестном/disabled; single mode заменяет;
  - `deselect(id)` — no-op если не выбран; `toggle(id)`;
  - `selectAll(candidates?)` — только enabled; возвращает добавленные items;
  - `clear()`;
  - `setItems(newItems): CustomSelectItem[]` — возврат исчезнувших выбранных;
  - `setValue(ids): {added, removed}` — строгий, диффы новыми массивами;
  - `setMultiple(multiple): CustomSelectItem[]` — collapse оставляет первый выбранный, возвращает снятых;
  - Геттеры: `getItems()`, `getItem(id)`, `getSelectedIds()`, `getSelectedItems()`, `isEnabled(id)`, `isMultiple()`.

- [ ] **Step 1: Падающие тесты**

```js
import { describe, it, expect } from 'vitest';
import StateManager from '../../src/core/StateManager.js';

const text = (id, extra = {}) => ({ id, type: 'text', content: `c${String(id)}`, ...extra });
const items = () => [text(1), text(2), text(3, { disabled: true }), text('1'), text('g', { group: 'G' })];

describe('selection basics', () => {
    it('select/deselect/toggle', () => {
        const sm = new StateManager({ items: items() });
        sm.select(1);
        expect(sm.getSelectedIds()).toEqual([1]);
        sm.select(2);
        expect(sm.getSelectedIds()).toEqual([1, 2]);
        sm.toggle(2);
        expect(sm.getSelectedIds()).toEqual([1]);
        sm.deselect(99);
        expect(sm.getSelectedIds()).toEqual([1]);
    });

    it('single mode replaces', () => {
        const sm = new StateManager({ items: items(), multiple: false });
        sm.select(1);
        sm.select(2);
        expect(sm.getSelectedIds()).toEqual([2]);
    });

    it('rejects unknown and disabled ids on select', () => {
        const sm = new StateManager({ items: items() });
        expect(() => sm.select(404)).toThrow(Error);
        expect(() => sm.select(3)).toThrow(/disabled/i);
    });

    it('keeps 1 and "1" distinct', () => {
        const sm = new StateManager({ items: items(), multiple: true });
        sm.select(1);
        sm.select('1');
        expect(sm.getSelectedIds()).toEqual([1, '1']);
        sm.deselect(1);
        expect(sm.getSelectedIds()).toEqual(['1']);
    });

    it('insertion order after reselect is B,A', () => {
        const sm = new StateManager({ items: [text('a'), text('b')], multiple: true });
        sm.select('a');
        sm.select('b');
        sm.deselect('a');
        sm.select('a');
        expect(sm.getSelectedIds()).toEqual(['b', 'a']);
    });

    it('getters return fresh arrays', () => {
        const sm = new StateManager({ items: items(), multiple: true });
        sm.select(1);
        const ids = sm.getSelectedIds();
        ids.push(999);
        expect(sm.getSelectedIds()).toEqual([1]);
    });

    it('disabled ids selectable programmatically at construction only via selectedIds', () => {
        const sm = new StateManager({ items: items(), selectedIds: [3] });
        expect(sm.getSelectedIds()).toEqual([3]);
    });

    it('constructor rejects unknown id / multi-in-single', () => {
        expect(() => new StateManager({ items: items(), selectedIds: [404] })).toThrow(Error);
        expect(() => new StateManager({ items: items(), selectedIds: [1, 2] })).toThrow(TypeError);
    });
});

describe('mass operations', () => {
    it('selectAll skips disabled and already-selected', () => {
        const sm = new StateManager({ items: items(), multiple: true });
        const added = sm.selectAll();
        expect(added.map((i) => i.id)).toEqual([1, 2, '1', 'g']);
        expect(sm.selectAll([2, 3])).toEqual([]);
    });

    it('clear empties selection', () => {
        const sm = new StateManager({ items: items(), multiple: true, selectedIds: [1, 2] });
        sm.clear();
        expect(sm.getSelectedIds()).toEqual([]);
    });
});

describe('setValue', () => {
    it('computes diffs and replaces selection', () => {
        const sm = new StateManager({ items: items(), multiple: true, selectedIds: [1, 2] });
        const { added, removed } = sm.setValue([2, 'g']);
        expect(added.map((i) => i.id)).toEqual(['g']);
        expect(removed.map((i) => i.id)).toEqual([1]);
        expect(sm.getSelectedIds()).toEqual([2, 'g']);
    });

    it('rejects two ids in single mode and unknown ids', () => {
        const sm = new StateManager({ items: items() });
        expect(() => sm.setValue([1, 2])).toThrow(TypeError);
        expect(() => sm.setValue([404])).toThrow(Error);
    });
});

describe('setItems', () => {
    it('keeps surviving selection, reports removed', () => {
        const sm = new StateManager({ items: items(), multiple: true, selectedIds: [1, 2] });
        const removed = sm.setItems([text(2), text(9)]);
        expect(removed.map((i) => i.id)).toEqual([1]);
        expect(sm.getSelectedIds()).toEqual([2]);
        expect(sm.getItem(9)?.content).toBe('c9');
    });

    it('invalid new items leave state untouched', () => {
        const sm = new StateManager({ items: items(), selectedIds: [1] });
        expect(() => sm.setItems([text(1), text(1)])).toThrow(/duplicate/i);
        expect(sm.getSelectedIds()).toEqual([1]);
        expect(sm.getItems()).toHaveLength(5);
    });
});

describe('setMultiple collapse', () => {
    it('true->false keeps first selected, returns removed', () => {
        const sm = new StateManager({ items: items(), multiple: true, selectedIds: [1, 2, '1'] });
        const removed = sm.setMultiple(false);
        expect(removed.map((i) => i.id)).toEqual([2, '1']);
        expect(sm.getSelectedIds()).toEqual([1]);
        expect(sm.isMultiple()).toBe(false);
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация**

```js
import { validateItems } from './ConfigManager.js';

/**
 * @typedef {import('../types.js').CustomSelectItem} CustomSelectItem
 */

export default class StateManager {
    /** @type {CustomSelectItem[]} */
    #items = [];
    /** @type {Map<string|number, CustomSelectItem>} */
    #map = new Map();
    /** @type {Set<string|number>} */
    #selected = new Set();
    #multiple;

    /**
     * @param {Object} p
     * @param {CustomSelectItem[]} p.items
     * @param {(string|number)[]} [p.selectedIds]
     * @param {boolean} [p.multiple]
     */
    constructor({ items, selectedIds = [], multiple = false }) {
        this.#replaceItems(validateItems(items));
        this.#multiple = multiple === true;
        this.#applyStrictSelection(selectedIds);
    }

    /** @param {CustomSelectItem[]} arr */
    #replaceItems(arr) {
        this.#items = arr;
        this.#map = new Map(arr.map((item) => [item.id, item]));
    }

    /** @param {(string|number)[]} ids */
    #applyStrictSelection(ids) {
        if (!Array.isArray(ids)) throw new TypeError('selectedIds: expected array.');
        if (!this.#multiple && ids.length > 1) {
            throw new TypeError('Multiple selected ids provided in single mode.');
        }
        for (const id of ids) {
            if (!this.#map.has(id)) throw new Error(`Unknown selected id: ${String(id)}.`);
        }
        this.#selected = new Set(ids);
    }

    /** @returns {boolean} */
    isMultiple() {
        return this.#multiple;
    }

    /** @param {string|number} id @returns {CustomSelectItem|undefined} */
    getItem(id) {
        return this.#map.get(id);
    }

    /** @returns {CustomSelectItem[]} */
    getItems() {
        return [...this.#items];
    }

    /** @returns {(string|number)[]} */
    getSelectedIds() {
        return [...this.#selected];
    }

    /** @returns {CustomSelectItem[]} */
    getSelectedItems() {
        return [...this.#selected].map((id) => /** @type {CustomSelectItem} */ (this.#map.get(id)));
    }

    /** @param {string|number} id @returns {boolean} */
    isEnabled(id) {
        const item = this.#map.get(id);
        return item !== undefined && item.disabled !== true;
    }

    /** @param {string|number} id */
    #assertSelectable(id) {
        const item = this.#map.get(id);
        if (!item) throw new Error(`Unknown item id: ${String(id)}.`);
        if (item.disabled === true) throw new Error(`Item "${String(id)}" is disabled.`);
    }

    /** Single mode заменяет выбор. @param {string|number} id */
    select(id) {
        this.#assertSelectable(id);
        if (this.#selected.has(id)) return;
        if (!this.#multiple) this.#selected.clear();
        this.#selected.add(id);
    }

    /** @param {string|number} id */
    deselect(id) {
        this.#selected.delete(id);
    }

    /** @param {string|number} id */
    toggle(id) {
        if (this.#selected.has(id)) this.deselect(id);
        else this.select(id);
    }

    /**
     * @param {(string|number)[]} [candidates]
     * @returns {CustomSelectItem[]}
     */
    selectAll(candidates) {
        const source = candidates ?? this.#items.map((i) => i.id);
        /** @type {CustomSelectItem[]} */
        const added = [];
        for (const id of source) {
            if (this.isEnabled(id) && !this.#selected.has(id)) {
                this.#selected.add(id);
                added.push(/** @type {CustomSelectItem} */ (this.#map.get(id)));
            }
        }
        return added;
    }

    clear() {
        this.#selected.clear();
    }

    /**
     * @param {CustomSelectItem[]} newItems
     * @returns {CustomSelectItem[]}
     */
    setItems(newItems) {
        const validated = validateItems(newItems);
        const presentIds = new Set(validated.map((i) => i.id));
        /** @type {CustomSelectItem[]} */
        const removedSelected = [];
        for (const id of this.#selected) {
            if (!presentIds.has(id)) {
                removedSelected.push(/** @type {CustomSelectItem} */ (this.#map.get(id)));
            }
        }
        this.#replaceItems(validated);
        this.#selected = new Set([...this.#selected].filter((id) => this.#map.has(id)));
        return removedSelected;
    }

    /**
     * @param {(string|number)[]} ids
     * @returns {{added: CustomSelectItem[], removed: CustomSelectItem[]}}
     */
    setValue(ids) {
        if (!Array.isArray(ids)) throw new TypeError('setValue: expected array of ids.');
        if (!this.#multiple && ids.length > 1) {
            throw new TypeError('setValue: multiple ids provided in single mode.');
        }
        for (const id of ids) {
            if (!this.#map.has(id)) throw new Error(`Unknown id in setValue: ${String(id)}.`);
        }
        const next = new Set(ids);
        /** @type {CustomSelectItem[]} */
        const added = [];
        /** @type {CustomSelectItem[]} */
        const removed = [];
        for (const id of ids) {
            if (!this.#selected.has(id)) added.push(/** @type {CustomSelectItem} */ (this.#map.get(id)));
        }
        for (const id of this.#selected) {
            if (!next.has(id)) removed.push(/** @type {CustomSelectItem} */ (this.#map.get(id)));
        }
        this.#selected = next;
        return { added, removed };
    }

    /**
     * @param {boolean} multiple
     * @returns {CustomSelectItem[]}
     */
    setMultiple(multiple) {
        const was = this.#multiple;
        this.#multiple = multiple === true;
        if (was && !this.#multiple && this.#selected.size > 1) {
            const first = [...this.#selected][0];
            const rest = [...this.#selected].slice(1);
            this.#selected = new Set([/** @type {string|number} */ (first)]);
            return rest.map((id) => /** @type {CustomSelectItem} */ (this.#map.get(id)));
        }
        return [];
    }
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/StateManager.js tests/unit/StateManager.test.js && git commit -m "feat: StateManager with strict selection semantics"
```

---

### Task 7: SearchEngine

**Files:**
- Create: `src/core/SearchEngine.js`
- Test: `tests/unit/SearchEngine.test.js`

**Interfaces:**
- Produces:
  - `normalize(text, caseSensitive=false): string` — NFKC всегда, lowercase если не caseSensitive;
  - `tokenize(query): string[]` — trim + split по whitespace;
  - `isSubsequence(needle, haystack): boolean`;
  - `search(items, query, {searchMode?, searchCaseSensitive?}): CustomSelectItem[]` — порядок исходный; пустой query → копия всех; OR-по-полям × AND-по-токенам; image ищется ТОЛЬКО по keywords; кэш полей в module-level WeakMap (ключ caseSensitive учитывается);
  - `highlightSegments(text, rawTokens, {searchMode, searchCaseSensitive?}): Array<{text, match}>` — contains: все вхождения; startsWith: с позиции 0; exact: всё поле; fuzzy: жадные позиции подпоследовательности.

- [ ] **Step 1: Падающие тесты**

```js
import { describe, it, expect } from 'vitest';
import { normalize, tokenize, isSubsequence, search, highlightSegments } from '../../src/core/SearchEngine.js';

const t = (id, content, keywords) => ({ id, type: 'text', content, ...(keywords ? { searchKeywords: keywords } : {}) });
const img = (id, src, keywords) => ({ id, type: 'image', content: src, searchKeywords: keywords });

describe('normalize/tokenize/isSubsequence', () => {
    it('NFKC + lowercase by default', () => {
        expect(normalize('Ａｐｐｌе', false)).toBe(normalize('Apple', false));
        expect(normalize('AbC', true)).toBe('AbC');
    });
    it('tokenizes on whitespace', () => {
        expect(tokenize('  red   car ')).toEqual(['red', 'car']);
        expect(tokenize('   ')).toEqual([]);
    });
    it('subsequence order matters', () => {
        expect(isSubsequence('ap', 'apple')).toBe(true);
        expect(isSubsequence('pa', 'apple')).toBe(false);
    });
});

describe('search modes and semantics', () => {
    const catalog = [
        t(1, 'Red Car'),
        t(2, 'Blue Bus', ['vehicle']),
        img(3, 'https://x/red.png', ['photo']),
        t(4, 'cargo'),
    ];
    const c = { searchMode: 'contains' };

    it('empty query returns all in original order', () => {
        expect(search(catalog, '   ', c).map((i) => i.id)).toEqual([1, 2, 3, 4]);
    });

    it('contains is case-insensitive substring', () => {
        expect(search(catalog, 'CAR', c).map((i) => i.id)).toEqual([1, 4]);
    });

    it('startsWith anchors to field start', () => {
        const m = { searchMode: 'startsWith' };
        expect(search(catalog, 'car', m).map((i) => i.id)).toEqual([1, 4]);
        expect(search(catalog, 'ed', m)).toEqual([]);
    });

    it('exact requires full equality after normalization', () => {
        const m = { searchMode: 'exact' };
        expect(search(catalog, 'red car', m).map((i) => i.id)).toEqual([1]);
        expect(search(catalog, 'red', m)).toEqual([]);
    });

    it('fuzzy allows ordered gaps', () => {
        expect(search(catalog, 'bc', { searchMode: 'fuzzy' }).map((i) => i.id)).toEqual([2, 4]);
    });

    it('AND across tokens with OR across fields', () => {
        // «vehicle» есть только у #2, «red» — у #1/#3: пересечения нет
        expect(search(catalog, 'vehicle red', c)).toEqual([]);
        const cat2 = [t(1, 'Red Car', ['vehicle']), t(2, 'Blue Bus', ['vehicle'])];
        expect(search(cat2, 'red vehicle', c).map((i) => i.id)).toEqual([1]);
    });

    it('image searches keywords only, never content URL', () => {
        expect(search(catalog, 'png', c)).toEqual([]);
        expect(search(catalog, 'https', c)).toEqual([]);
        expect(search(catalog, 'photo', c).map((i) => i.id)).toEqual([3]);
    });

    it('case sensitive disables lowering but keeps NFKC', () => {
        const cs = { searchMode: 'contains', searchCaseSensitive: true };
        expect(search([t(1, 'Red Car')], 'red', cs)).toEqual([]);
        expect(search([t(1, 'Red Car')], 'Red', cs)).toHaveLength(1);
    });

    it('unicode normalization applies to item fields too', () => {
        expect(search([t(1, 'Ａｐｐｌе')], 'apple')).toHaveLength(1);
    });
});

describe('highlightSegments', () => {
    it('marks every contains occurrence', () => {
        expect(highlightSegments('my red car', ['red'], { searchMode: 'contains' })).toEqual([
            { text: 'my ', match: false },
            { text: 'red', match: true },
            { text: ' car', match: false },
        ]);
    });
    it('fuzzy marks subsequence positions greedily', () => {
        const segs = highlightSegments('apple', ['ap'], { searchMode: 'fuzzy' });
        expect(segs.filter((s) => s.match).map((s) => s.text).join('')).toBe('ap');
    });
    it('startsWith marks only prefix', () => {
        const segs = highlightSegments('cargo', ['car'], { searchMode: 'startsWith' });
        expect(segs[0]).toEqual({ text: 'car', match: true });
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация**

```js
/**
 * @typedef {import('../types.js').CustomSelectItem} CustomSelectItem
 * @typedef {import('../types.js').SearchMode} SearchMode
 */

/**
 * @param {string} text
 * @param {boolean} [caseSensitive=false]
 * @returns {string}
 */
export function normalize(text, caseSensitive = false) {
    const nfkc = text.normalize('NFKC');
    return caseSensitive ? nfkc : nfkc.toLowerCase();
}

/**
 * @param {string} query
 * @returns {string[]}
 */
export function tokenize(query) {
    return query.trim().split(/\s+/u).filter(Boolean);
}

/**
 * @param {string} needle
 * @param {string} haystack
 * @returns {boolean}
 */
export function isSubsequence(needle, haystack) {
    let hi = 0;
    outer: for (const ch of needle) {
        while (hi < haystack.length) {
            if (haystack[hi] === ch) {
                hi += 1;
                continue outer;
            }
            hi += 1;
        }
        return false;
    }
    return true;
}

/** @type {WeakMap<CustomSelectItem, {fields: string[], caseSensitive: boolean}>} */
const fieldCache = new WeakMap();

/**
 * Нормализованные поля item: для text — content + keywords, для image — только keywords.
 * @param {CustomSelectItem} item
 * @param {boolean} caseSensitive
 * @returns {string[]}
 */
function getItemFields(item, caseSensitive) {
    const cached = fieldCache.get(item);
    if (cached && cached.caseSensitive === caseSensitive) return cached.fields;
    /** @type {string[]} */
    const fields = [];
    if (item.type === 'text') fields.push(normalize(item.content, caseSensitive));
    if (Array.isArray(item.searchKeywords)) {
        for (const kw of item.searchKeywords) fields.push(normalize(kw, caseSensitive));
    }
    fieldCache.set(item, { fields, caseSensitive });
    return fields;
}

/**
 * @param {string} token нормализованный токен
 * @param {string[]} fields нормализованные поля
 * @param {SearchMode} mode
 * @returns {boolean}
 */
function matchToken(token, fields, mode) {
    switch (mode) {
        case 'startsWith':
            return fields.some((f) => f.startsWith(token));
        case 'exact':
            return fields.some((f) => f === token);
        case 'fuzzy':
            return fields.some((f) => isSubsequence(token, f));
        case 'contains':
        default:
            return fields.some((f) => f.includes(token));
    }
}

/**
 * @param {CustomSelectItem[]} items
 * @param {string} query
 * @param {Object} [opts]
 * @param {SearchMode} [opts.searchMode='contains']
 * @param {boolean} [opts.searchCaseSensitive=false]
 * @returns {CustomSelectItem[]}
 */
export function search(items, query, opts = {}) {
    const mode = opts.searchMode ?? 'contains';
    const caseSensitive = opts.searchCaseSensitive === true;
    const tokens = tokenize(query).map((tok) => normalize(tok, caseSensitive));
    if (tokens.length === 0) return [...items];
    return items.filter((item) => {
        const fields = getItemFields(item, caseSensitive);
        if (fields.length === 0) return false;
        return tokens.every((tok) => matchToken(tok, fields, mode));
    });
}

/**
 * Сегменты текста для безопасной подсветки (DOM-узлы, не HTML).
 * @param {string} text сырой текст поля
 * @param {string[]} tokens сырые токены запроса
 * @param {Object} opts
 * @param {SearchMode} opts.searchMode
 * @param {boolean} [opts.searchCaseSensitive]
 * @returns {Array<{text: string, match: boolean}>}
 */
export function highlightSegments(text, tokens, opts) {
    const mode = opts.searchMode;
    const cs = opts.searchCaseSensitive === true;
    const norm = normalize(text, cs);
    /** @type {boolean[]} */
    const marks = new Array(text.length).fill(false);

    for (const rawToken of tokens) {
        const tok = normalize(rawToken, cs);
        if (!tok) continue;
        if (mode === 'contains') {
            let from = 0;
            for (;;) {
                const idx = norm.indexOf(tok, from);
                if (idx === -1) break;
                for (let i = idx; i < idx + tok.length; i++) marks[i] = true;
                from = idx + tok.length;
            }
        } else if (mode === 'startsWith') {
            if (norm.startsWith(tok)) {
                for (let i = 0; i < tok.length; i++) marks[i] = true;
            }
        } else if (mode === 'exact') {
            if (norm === tok) marks.fill(true);
        } else {
            let hi = 0;
            for (const ch of tok) {
                while (hi < norm.length && norm[hi] !== ch) hi += 1;
                if (hi >= norm.length) break;
                marks[hi] = true;
                hi += 1;
            }
        }
    }

    /** @type {Array<{text: string, match: boolean}>} */
    const segments = [];
    let buffer = '';
    let current = /** @type {boolean} */ (marks[0] ?? false);
    for (let i = 0; i < text.length; i++) {
        if (marks[i] === current) {
            buffer += text[i];
        } else {
            segments.push({ text: buffer, match: current });
            buffer = text[i];
            current = /** @type {boolean} */ (marks[i]);
        }
    }
    if (buffer) segments.push({ text: buffer, match: current });
    return segments;
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/SearchEngine.js tests/unit/SearchEngine.test.js && git commit -m "feat: SearchEngine with 4 modes, AND/OR semantics, highlighting"
```

---

### Task 8: PositionEngine (чистая математика)

**Files:**
- Create: `src/core/PositionEngine.js`
- Test: `tests/unit/PositionEngine.test.js`

**Interfaces:**
- Produces: `calculatePlacement(triggerRect: SimpleRect, popoverRect: SimpleRect, viewport: {width,height}, {offset?=4, maxHeight?=320, margin?=8}): PlacementResult`. Логика спеки §47–48: below если хватает места; иначе above; иначе большая сторона с clamp высоты (popover никогда не выходит за viewport вертикально); гориз.: left=trigger.left, clamp справа, затем margin слева; width clamp до viewport − 2·margin.

- [ ] **Step 1: Падающие тесты**

```js
import { describe, it, expect } from 'vitest';
import { calculatePlacement } from '../../src/core/PositionEngine.js';

const vp = { width: 1000, height: 800 };
const pop = { left: 0, top: 0, width: 300, height: 250 };
const O = { offset: 4, maxHeight: 320, margin: 8 };

describe('vertical placement', () => {
    it('places below when space suffices', () => {
        const trig = { left: 100, top: 100, width: 200, height: 40 };
        const r = calculatePlacement(trig, pop, vp, O);
        expect(r.below).toBe(true);
        expect(r.top).toBe(trig.top + trig.height + 4);
        expect(r.left).toBe(100);
    });

    it('flips above when below is tight', () => {
        const trig = { left: 100, top: 700, width: 200, height: 40 };
        const r = calculatePlacement(trig, pop, vp, O);
        expect(r.below).toBe(false);
        expect(r.top + r.height).toBeLessThanOrEqual(trig.top - 4);
    });

    it('picks larger side and clamps inside viewport when both tight', () => {
        const trig = { left: 0, top: 380, width: 1000, height: 40 };
        const big = { left: 0, top: 0, width: 300, height: 600 };
        const r = calculatePlacement(trig, big, vp, { ...O, maxHeight: 600 });
        expect(r.top).toBeGreaterThanOrEqual(0);
        expect(r.top + r.height).toBeLessThanOrEqual(vp.height);
    });

    it('respects maxHeight cap', () => {
        const trig = { left: 0, top: 100, width: 100, height: 40 };
        const giant = { left: 0, top: 0, width: 200, height: 5000 };
        const r = calculatePlacement(trig, giant, vp, O);
        expect(r.height).toBeLessThanOrEqual(320);
    });
});

describe('horizontal placement', () => {
    it('clamps right overflow keeping margin', () => {
        const trig = { left: 850, top: 100, width: 140, height: 40 };
        const r = calculatePlacement(trig, pop, vp, O);
        expect(r.left + r.width).toBeLessThanOrEqual(vp.width - 8);
    });

    it('clamps width when popover wider than viewport', () => {
        const wide = { left: 0, top: 0, width: 2000, height: 200 };
        const r = calculatePlacement({ left: 100, top: 700, width: 200, height: 40 }, wide, vp, O);
        expect(r.width).toBe(vp.width - 16);
        expect(r.left).toBe(8);
    });

    it('never produces negative left', () => {
        const r = calculatePlacement({ left: 5, top: 100, width: 50, height: 40 }, pop, vp, O);
        expect(r.left).toBeGreaterThanOrEqual(8);
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация**

```js
/**
 * @typedef {import('../types.js').SimpleRect} SimpleRect
 * @typedef {import('../types.js').PlacementResult} PlacementResult
 */

/**
 * Чистая функция позиционирования popover относительно триггера (спека §46–48).
 * @param {SimpleRect} triggerRect
 * @param {SimpleRect} popoverRect intrinsic size
 * @param {{width: number, height: number}} viewport
 * @param {Object} [opts]
 * @param {number} [opts.offset=4]
 * @param {number} [opts.maxHeight=320]
 * @param {number} [opts.margin=8]
 * @returns {PlacementResult}
 */
export function calculatePlacement(triggerRect, popoverRect, viewport, opts = {}) {
    const offset = opts.offset ?? 4;
    const maxHeight = opts.maxHeight ?? 320;
    const margin = opts.margin ?? 8;

    const desiredHeight = Math.min(popoverRect.height, maxHeight);
    const availBelow = viewport.height - triggerRect.top - triggerRect.height - offset - margin;
    const availAbove = triggerRect.top - offset - margin;
    const below = availBelow >= desiredHeight ? true : availAbove >= desiredHeight ? false : availBelow >= availAbove;

    const height = Math.max(Math.min(desiredHeight, below ? availBelow : availAbove), 0);
    const top = below
        ? triggerRect.top + triggerRect.height + offset
        : triggerRect.top - offset - height;

    const maxWidth = viewport.width - margin * 2;
    const width = Math.min(popoverRect.width, maxWidth);
    let left = triggerRect.left;
    if (left + width > viewport.width - margin) left = viewport.width - margin - width;
    if (left < margin) left = margin;

    return { left, top, width, height, below };
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/PositionEngine.js tests/unit/PositionEngine.test.js && git commit -m "feat: pure placement math"
```

---

### Task 9: ProximityEngine

**Files:**
- Create: `src/core/ProximityEngine.js`
- Test: `tests/unit/ProximityEngine.test.js`

**Interfaces:**
- Produces:
  - `pointDistanceToRect(x, y, rect): number` — AABB-дистанция (спека §50);
  - `default class ProximityEngine`: `constructor({threshold, getRects: ()=>({main, popover}), onThresholdExceeded, raf?, cancelRaf?, eventTarget?})`; методы `attach()`, `detach()`, `reset()`.
  - Правила спеки (§50–52 + решение №10): фильтр `pointerType==='mouse'`; raw event только сохраняет точку, вычисление в RAF; **armed=true только когда курсор побывал внутри main или popover**; закрытие (`onThresholdExceeded`) только когда armed и дистанция > threshold; reset сбрасывает точку и armed (фасад вызывает reset при каждом open).
  - Инъекции `raf`/`cancelRaf`/`eventTarget` нужны юнит-тестам (в Node нет rAF/window).

- [ ] **Step 1: Падающие тесты**

```js
import { describe, it, expect, vi } from 'vitest';
import ProximityEngine, { pointDistanceToRect } from '../../src/core/ProximityEngine.js';

const rect = (left, top, width, height) => ({ left, top, width, height });

describe('pointDistanceToRect', () => {
    const r = rect(10, 10, 100, 50);
    it('inside → 0', () => expect(pointDistanceToRect(50, 30, r)).toBe(0));
    it('on edge → 0', () => expect(pointDistanceToRect(110, 30, r)).toBe(0));
    it('right side → dx', () => expect(pointDistanceToRect(120, 30, r)).toBe(10));
    it('corner → euclidean', () =>
        expect(pointDistanceToRect(120, 70, r)).toBeCloseTo(Math.sqrt(200)));
    it('above → dy', () => expect(pointDistanceToRect(50, 0, r)).toBe(10));
});

function makeSyncEngine(overrides = {}) {
    const pending = [];
    const target = new EventTarget();
    const engine = new ProximityEngine({
        threshold: 150,
        eventTarget: target,
        getRects: () => ({ main: rect(0, 0, 100, 40), popover: rect(0, 50, 300, 200) }),
        raf: (cb) => { pending.push(cb); return pending.length; },
        cancelRaf: () => {},
        ...overrides,
    });
    const flush = () => {
        const copy = [...pending];
        pending.length = 0;
        copy.forEach((cb) => cb());
    };
    const move = (x, y, pointerType = 'mouse') =>
        target.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType, clientX: x, clientY: y }));
    return { engine, flush, move };
}

describe('ProximityEngine lifecycle', () => {
    it('never fires without mouse movement', () => {
        const onExceed = vi.fn();
        const { engine } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        engine.detach();
        expect(onExceed).not.toHaveBeenCalled();
    });

    it('ignores non-mouse pointers', () => {
        const onExceed = vi.fn();
        const { engine, flush, move } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        move(900, 900, 'touch');
        flush();
        expect(onExceed).not.toHaveBeenCalled();
        engine.detach();
    });

    it('distant bump before entering area neither arms nor fires', () => {
        const onExceed = vi.fn();
        const { engine, flush, move } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        move(900, 900);
        flush();
        expect(onExceed).not.toHaveBeenCalled();
        engine.detach();
    });

    it('arms after entering popover, fires beyond threshold', () => {
        const onExceed = vi.fn();
        const { engine, flush, move } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        move(150, 150);
        flush();
        expect(onExceed).not.toHaveBeenCalled();
        move(900, 900);
        flush();
        expect(onExceed).toHaveBeenCalledTimes(1);
        engine.detach();
    });

    it('reset clears point+armed: distant bump afterwards does not fire', () => {
        const onExceed = vi.fn();
        const { engine, flush, move } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        move(150, 150);
        flush();
        engine.reset();
        move(900, 900);
        flush();
        expect(onExceed).not.toHaveBeenCalled();
        engine.detach();
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация**

```js
/**
 * @typedef {import('../types.js').SimpleRect} SimpleRect
 */

/**
 * Расстояние от точки до AABB (спека §50).
 * @param {number} x
 * @param {number} y
 * @param {SimpleRect} rect
 * @returns {number}
 */
export function pointDistanceToRect(x, y, rect) {
    const dx = Math.max(rect.left - x, 0, x - (rect.left + rect.width));
    const dy = Math.max(rect.top - y, 0, y - (rect.top + rect.height));
    return Math.hypot(dx, dy);
}

export default class ProximityEngine {
    #threshold;
    #getRects;
    #onThresholdExceeded;
    #rafFn;
    #cancelRafFn;
    #eventTarget;
    /** @type {(event: PointerEvent) => void} */
    #listener;
    #rafId = 0;
    /** @type {{x: number, y: number} | null} */
    #point = null;
    #armed = false;

    /**
     * @param {Object} opts
     * @param {number} opts.threshold
     * @param {() => {main: SimpleRect, popover: SimpleRect}} opts.getRects
     * @param {() => void} opts.onThresholdExceeded
     * @param {(cb: Function) => number} [opts.raf]
     * @param {(id: number) => void} [opts.cancelRaf]
     * @param {EventTarget} [opts.eventTarget]
     */
    constructor({ threshold, getRects, onThresholdExceeded, raf, cancelRaf, eventTarget }) {
        this.#threshold = threshold;
        this.#getRects = getRects;
        this.#onThresholdExceeded = onThresholdExceeded;
        this.#rafFn = raf ?? ((cb) => requestAnimationFrame(cb));
        this.#cancelRafFn = cancelRaf ?? ((id) => cancelAnimationFrame(id));
        this.#eventTarget = eventTarget ?? window;
        this.#listener = (event) => this.#handlePointerMove(event);
    }

    attach() {
        this.reset();
        this.#eventTarget.addEventListener('pointermove', this.#listener);
    }

    detach() {
        this.#eventTarget.removeEventListener('pointermove', this.#listener);
        this.reset();
    }

    reset() {
        this.#point = null;
        this.#armed = false;
        if (this.#rafId) {
            this.#cancelRafFn(this.#rafId);
            this.#rafId = 0;
        }
    }

    /** @param {PointerEvent} event */
    #handlePointerMove(event) {
        if (event.pointerType !== 'mouse') return;
        this.#point = { x: event.clientX, y: event.clientY };
        if (this.#rafId) return;
        this.#rafId = this.#rafFn(() => {
            this.#rafId = 0;
            this.#evaluate();
        });
    }

    #evaluate() {
        const point = this.#point;
        if (!point) return;
        const { main, popover } = this.#getRects();
        const dMin = Math.min(
            pointDistanceToRect(point.x, point.y, main),
            pointDistanceToRect(point.x, point.y, popover),
        );
        if (!this.#armed) {
            if (dMin === 0) this.#armed = true;
            return;
        }
        if (dMin > this.#threshold) this.#onThresholdExceeded();
    }
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/ProximityEngine.js tests/unit/ProximityEngine.test.js && git commit -m "feat: ProximityEngine with mouse filter and arming rule"
```

---

### Task 10: KeyboardNav

**Files:**
- Create: `src/core/KeyboardNav.js`
- Test: `tests/unit/KeyboardNav.test.js`

**Interfaces:**
- Produces: `default class KeyboardNav`:
  - `constructor({getModel, setActiveId, onSelectIntent, onRequestClose})`;
  - Модель: `{options: Array<{id, disabled?, element?}>, rowCount: number|null, activeId}`;
  - `handleKeyDown(event): void`. Клавиши: ArrowUp/Down/Left/Right, Home, End, Enter, ' ' (Space), Escape. Single-column (`rowCount===null`): Up/Down ±1, Left/Right no-op. Multi-column (заполнение column-major, как CSS `grid-auto-flow: column`): Down=+R, Up=−R, Left=−1, Right=+1. Без wrap-around; clamp на границах; disabled пропускаются в направлении движения; Home/End — первый/последний enabled. Enter/' ': intent только для enabled активной опции. Escape → `onRequestClose()`. Смена active: `setActiveId(id)` + `element.scrollIntoView?.({block:'nearest'})`. `preventDefault()` на обработанных клавишах.

- [ ] **Step 1: Падающие тесты**

```js
import { describe, it, expect, vi } from 'vitest';
import KeyboardNav from '../../src/core/KeyboardNav.js';

function setup(options, rowCount = null, activeId = null) {
    const model = { options, rowCount, activeId };
    const setActive = vi.fn((id) => { model.activeId = id; });
    const selectIntent = vi.fn();
    const closeReq = vi.fn();
    const nav = new KeyboardNav({
        getModel: () => model,
        setActiveId: setActive,
        onSelectIntent: selectIntent,
        onRequestClose: closeReq,
    });
    return { nav, model, setActive, selectIntent, closeReq };
}

const opt = (id, disabled = false) => ({ id, disabled, element: { scrollIntoView: vi.fn() } });
const key = (k) => /** @type {any} */ ({ key: k, preventDefault: vi.fn() });

describe('single column', () => {
    const opts = () => [opt('a'), opt('b'), opt('c', true), opt('d')];

    it('ArrowDown skips disabled without wrap', () => {
        const { nav, model, setActive } = setup(opts(), null, 'a');
        nav.handleKeyDown(key('ArrowDown'));
        expect(setActive).toHaveBeenLastCalledWith('b');
        model.activeId = 'b';
        nav.handleKeyDown(key('ArrowDown'));
        expect(setActive).toHaveBeenLastCalledWith('d');
        model.activeId = 'd';
        nav.handleKeyDown(key('ArrowDown'));
        expect(setActive).toHaveBeenCalledTimes(2);
    });

    it('Left/Right are no-op in single column', () => {
        const { nav, setActive } = setup(opts(), null, 'a');
        nav.handleKeyDown(key('ArrowRight'));
        nav.handleKeyDown(key('ArrowLeft'));
        expect(setActive).not.toHaveBeenCalled();
    });

    it('Home/End pick first/last enabled', () => {
        const { nav, setActive } = setup(opts(), null, null);
        nav.handleKeyDown(key('Home'));
        expect(setActive).toHaveBeenLastCalledWith('a');
        nav.handleKeyDown(key('End'));
        expect(setActive).toHaveBeenLastCalledWith('d');
    });

    it('ArrowUp clamps at top', () => {
        const { nav, setActive } = setup(opts(), null, 'a');
        nav.handleKeyDown(key('ArrowUp'));
        expect(setActive).not.toHaveBeenCalled();
    });
});

describe('grid navigation (rowCount=2)', () => {
    const opts = () => [opt(1), opt(2), opt(3), opt(4), opt(5)];

    it('Up/Down move by row count with clamp', () => {
        const { nav, setActive } = setup(opts(), 2, 5);
        nav.handleKeyDown(key('ArrowDown'));
        expect(setActive).not.toHaveBeenCalled();
        nav.handleKeyDown(key('ArrowUp'));
        expect(setActive).toHaveBeenLastCalledWith(3);
        nav.handleKeyDown(key('ArrowUp'));
        expect(setActive).toHaveBeenLastCalledWith(1);
        nav.handleKeyDown(key('ArrowUp'));
        expect(setActive).toHaveBeenCalledTimes(2);
    });

    it('Left/Right move by one with clamp', () => {
        const { nav, setActive } = setup(opts(), 2, 1);
        nav.handleKeyDown(key('ArrowLeft'));
        expect(setActive).not.toHaveBeenCalled();
        nav.handleKeyDown(key('ArrowRight'));
        expect(setActive).toHaveBeenLastCalledWith(2);
    });
});

describe('activation and escape', () => {
    it('Enter/Space fire intent only on enabled option', () => {
        const { nav, selectIntent } = setup([opt('a'), opt('b', true)], null, 'b');
        nav.handleKeyDown(key('Enter'));
        nav.handleKeyDown(key(' '));
        expect(selectIntent).not.toHaveBeenCalled();
    });

    it('Enter on enabled fires intent with its id', () => {
        const { nav, selectIntent } = setup([opt('a')], null, 'a');
        nav.handleKeyDown(key('Enter'));
        expect(selectIntent).toHaveBeenCalledWith('a');
    });

    it('Escape requests close even with empty list', () => {
        const { nav, closeReq } = setup([], null, null);
        nav.handleKeyDown(key('Escape'));
        expect(closeReq).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация**

```js
/**
 * @typedef {{id: string|number, disabled?: boolean, element?: {scrollIntoView?: Function}}} NavOption
 * @typedef {{options: NavOption[], rowCount: number|null, activeId: string|number|null}} NavModel
 */

export default class KeyboardNav {
    #getModel;
    #setActiveId;
    #onSelectIntent;
    #onRequestClose;

    /**
     * @param {Object} hooks
     * @param {() => NavModel} hooks.getModel
     * @param {(id: string|number|null) => void} hooks.setActiveId
     * @param {(id: string|number) => void} hooks.onSelectIntent
     * @param {() => void} hooks.onRequestClose
     */
    constructor({ getModel, setActiveId, onSelectIntent, onRequestClose }) {
        this.#getModel = getModel;
        this.#setActiveId = setActiveId;
        this.#onSelectIntent = onSelectIntent;
        this.#onRequestClose = onRequestClose;
    }

    /** @param {KeyboardEvent} event */
    handleKeyDown(event) {
        const model = this.#getModel();
        const { options } = model;
        if (options.length === 0 && event.key !== 'Escape') return;

        const index = options.findIndex((o) => o.id === model.activeId);
        /** @type {number|null} */
        let target = null;

        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                this.#onRequestClose();
                return;
            case 'Home': {
                target = this.#scan(options, 0, 1);
                break;
            }
            case 'End': {
                target = this.#scan(options, options.length - 1, -1);
                break;
            }
            case 'ArrowDown': {
                target = this.#step(options, index, model.rowCount ?? 1);
                break;
            }
            case 'ArrowUp': {
                target = this.#step(options, index, -(model.rowCount ?? 1));
                break;
            }
            case 'ArrowRight': {
                if (model.rowCount === null) return;
                target = this.#step(options, index, 1);
                break;
            }
            case 'ArrowLeft': {
                if (model.rowCount === null) return;
                target = this.#step(options, index, -1);
                break;
            }
            case 'Enter':
            case ' ': {
                if (index >= 0 && options[index]?.disabled !== true) {
                    event.preventDefault();
                    this.#onSelectIntent(/** @type {NavOption} */ (options[index]).id);
                }
                return;
            }
            default:
                return;
        }

        event.preventDefault();
        if (target !== null && target !== index) this.#activate(/** @type {NavOption} */ (options[target]));
    }

    /**
     * Сдвиг с пропуском disabled и clamp без wrap.
     * @param {NavOption[]} options
     * @param {number} index текущий (-1 если нет)
     * @param {number} delta
     * @returns {number|null}
     */
    #step(options, index, delta) {
        if (index < 0) {
            return delta > 0 ? this.#scan(options, 0, 1) : this.#scan(options, options.length - 1, -1);
        }
        let next = index + delta;
        const direction = Math.sign(delta);
        while (next >= 0 && next < options.length && options[next]?.disabled === true) {
            next += direction;
        }
        if (next < 0 || next >= options.length) return null;
        return next;
    }

    /**
     * Первый enabled начиная с from в направлении dir.
     * @param {NavOption[]} options
     * @param {number} from
     * @param {number} dir
     * @returns {number|null}
     */
    #scan(options, from, dir) {
        let i = from;
        while (i >= 0 && i < options.length && options[i]?.disabled === true) i += dir;
        return i >= 0 && i < options.length ? i : null;
    }

    /** @param {NavOption} option */
    #activate(option) {
        this.#setActiveId(option.id);
        option.element?.scrollIntoView?.({ block: 'nearest' });
    }
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/KeyboardNav.js tests/unit/KeyboardNav.test.js && git commit -m "feat: intent-based KeyboardNav with grid support"
```

---

### Task 11: DomRenderer — основной модуль

**Files:**
- Create: `src/core/DomRenderer.js`
- Test: `tests/unit/DomRenderer.helpers.test.js` (чистые экспорты; DOM проверяется в integration)

**Interfaces:**
- Produces:
  - `groupItems(items): ItemGroup[]` — чистый экспорт: порядок групп по первому появлению; элементы без `group` → группа `name:null`, тоже по первому появлению;
  - `accessibleName(item): string` — ariaLabel → searchKeywords.join(', ') → String(id) (спека §4.3);
  - `default class DomRenderer` c конструктором `({instanceId})`:
    - `renderMain(target, config): MainRefs` — строит root (`role="group"`, классы `csel-root`), внутри: `.csel-value-area` > [`.csel-value-text`, `.csel-tags`, `.csel-more`], `.csel-placeholder`, `.csel-clear`, `.csel-toggle` (кнопка c chevron-SVG через createElementNS, `aria-haspopup="listbox"`, `aria-expanded="false"`, `aria-controls="${instanceId}-popover"`). Refs: `{root, valueText, placeholder, tagsContainer, moreButton, clearButton, toggleButton}`; геттер `elements`;
    - `renderValue(item|null, config)` — single mode: текст контента / img (`img.src`, БЕЗ alt) либо placeholder;
    - `renderTags(items, config)` — pills `.csel-tag` с content + `.csel-tag-remove[data-id]`; полная перестройка через fragment;
    - `setMoreVisible(bool)`, `setClearVisible(bool)` (hidden-атрибут);
    - `setStateFlags(config)` — классы `--disabled/--readonly/--loading`, tabindex, aria-disabled, disabled у кнопок (remove/clear/more блокируются при readonly+disabled);
    - `disposeMain()`.

DOM-методы этого таска интеграционно проверяются позже; юнит — только чистые функции.

- [ ] **Step 1: Падающий тест чистых экспортов**

```js
import { describe, it, expect } from 'vitest';
import { groupItems, accessibleName } from '../../src/core/DomRenderer.js';

describe('groupItems', () => {
    const mk = (id, group) => ({ id, type: 'text', content: String(id), ...(group ? { group } : {}) });

    it('groups by first appearance preserving inner order', () => {
        const groups = groupItems([mk(1, 'B'), mk(2, 'A'), mk(3, 'B'), mk(4)]);
        expect(groups.map((g) => g.name)).toEqual(['B', 'A', null]);
        expect(groups[0].items.map((i) => i.id)).toEqual([1, 3]);
        expect(groups[2].items.map((i) => i.id)).toEqual([4]);
    });

    it('repeated group does not duplicate', () => {
        const x = (id) => ({ id, type: 'text', content: String(id), group: 'X' });
        expect(groupItems([x(1), x(2)])).toHaveLength(1);
    });
});

describe('accessibleName', () => {
    it('prefers ariaLabel then keywords then id', () => {
        expect(accessibleName({ id: 7, type: 'image', content: 'x.png', ariaLabel: 'L' })).toBe('L');
        expect(accessibleName({ id: 7, type: 'image', content: 'x.png', searchKeywords: ['a', 'b'] })).toBe('a, b');
        expect(accessibleName({ id: 7, type: 'image', content: 'x.png' })).toBe('7');
    });
});
```

- [ ] **Step 2: Run → FAIL**

Run: `npm run test:unit`

- [ ] **Step 3: Реализация части 1**

```js
/**
 * @typedef {import('../types.js').CustomSelectItem} CustomSelectItem
 * @typedef {import('../types.js').CustomSelectConfig} CustomSelectConfig
 */

/**
 * Группировка с сохранением порядка первого появления (спека §4.4).
 * @param {CustomSelectItem[]} items
 * @returns {Array<{name: string|null, items: CustomSelectItem[]}>}
 */
export function groupItems(items) {
    /** @type {Map<string|null, CustomSelectItem[]>} */
    const groups = new Map();
    for (const item of items) {
        const key = typeof item.group === 'string' && item.group !== '' ? item.group : null;
        let bucket = groups.get(key);
        if (!bucket) {
            bucket = [];
            groups.set(key, bucket);
        }
        bucket.push(item);
    }
    return [...groups.entries()].map(([name, grouped]) => ({ name, items: grouped }));
}

/**
 * Доступное имя опции (спека §4.3).
 * @param {CustomSelectItem} item
 * @returns {string}
 */
export function accessibleName(item) {
    if (typeof item.ariaLabel === 'string' && item.ariaLabel !== '') return item.ariaLabel;
    if (Array.isArray(item.searchKeywords) && item.searchKeywords.length > 0) {
        return item.searchKeywords.join(', ');
    }
    return String(item.id);
}

export default class DomRenderer {
    #instanceId;
    /** @type {Record<string, HTMLElement>} */
    #els = {};
    /** @type {Set<(btn: HTMLButtonElement) => void>} */
    #tagRemoveButtons = /** @type {Set<HTMLButtonElement>} */ (new Set());

    /** @param {{instanceId: string}} p */
    constructor({ instanceId }) {
        this.#instanceId = instanceId;
    }

    /** @returns {Record<string, HTMLElement>} */
    get elements() {
        return this.#els;
    }

    /**
     * @param {HTMLElement} target
     * @param {CustomSelectConfig} config
     */
    renderMain(target, config) {
        const root = document.createElement('div');
        root.className = 'csel-root';
        root.setAttribute('role', 'group');
        root.tabIndex = 0;

        const valueArea = document.createElement('div');
        valueArea.className = 'csel-value-area';

        const valueText = document.createElement('span');
        valueText.className = 'csel-value-text';

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'csel-tags';

        const moreButton = document.createElement('button');
        moreButton.type = 'button';
        moreButton.className = 'csel-more';
        moreButton.textContent = '...';
        moreButton.tabIndex = -1;
        moreButton.hidden = true;

        valueArea.append(valueText, tagsContainer, moreButton);

        const placeholder = document.createElement('span');
        placeholder.className = 'csel-placeholder';
        placeholder.textContent = config.placeholder;

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'csel-clear';
        clearButton.textContent = '×';
        clearButton.setAttribute('aria-label', 'Очистить выбор');
        clearButton.tabIndex = -1;
        clearButton.hidden = true;

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'csel-toggle';
        toggleButton.setAttribute('aria-haspopup', 'listbox');
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.setAttribute('aria-controls', `${this.#instanceId}-popover`);
        const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chevron.setAttribute('viewBox', '0 0 16 16');
        chevron.setAttribute('width', '14');
        chevron.setAttribute('height', '14');
        chevron.setAttribute('aria-hidden', 'true');
        chevron.classList.add('csel-chevron');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M4 6l4 4 4-4');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.5');
        chevron.append(path);
        toggleButton.append(chevron);

        root.append(valueArea, placeholder, clearButton, toggleButton);
        target.append(root);

        this.#els = { root, valueText, tagsContainer, moreButton, placeholder, clearButton, toggleButton };
        return this.#els;
    }

    /**
     * Single mode: значение текстом/img или placeholder.
     * @param {CustomSelectItem|null} item
     * @param {CustomSelectConfig} config
     */
    renderValue(item, config) {
        const { valueText, placeholder } = this.#els;
        valueText.replaceChildren();
        const has = item !== null;
        valueText.hidden = !has;
        placeholder.hidden = has;
        if (item !== null) {
            if (item.type === 'image') {
                const img = document.createElement('img');
                img.src = item.content;
                img.className = 'csel-img';
                valueText.append(img);
            } else {
                valueText.append(document.createTextNode(item.content));
            }
        } else {
            placeholder.textContent = config.placeholder;
        }
    }

    /**
     * Полная перестройка тегов (multiple).
     * @param {CustomSelectItem[]} selected
     * @param {CustomSelectConfig} _config
     */
    renderTags(selected, _config) {
        const { tagsContainer } = this.#els;
        tagsContainer.replaceChildren();
        this.#tagRemoveButtons.clear();
        const frag = document.createDocumentFragment();
        for (const item of selected) {
            const tag = document.createElement('span');
            tag.className = 'csel-tag';
            tag.dataset.id = String(item.id);

            const content = document.createElement('span');
            content.className = 'csel-tag-content';
            if (item.type === 'image') {
                const img = document.createElement('img');
                img.src = item.content;
                img.className = 'csel-img';
                content.append(img);
            } else {
                content.append(document.createTextNode(item.content));
            }

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'csel-tag-remove';
            remove.textContent = '×';
            remove.dataset.id = String(item.id);
            remove.setAttribute('aria-label', `Удалить ${accessibleName(item)}`);
            remove.tabIndex = -1;
            this.#tagRemoveButtons.add(remove);

            tag.append(content, remove);
            frag.append(tag);
        }
        tagsContainer.append(frag);
    }

    /** @param {boolean} visible */
    setMoreVisible(visible) {
        this.#els.moreButton.hidden = !visible;
    }

    /** @param {boolean} visible */
    setClearVisible(visible) {
        this.#els.clearButton.hidden = !visible;
    }

    /** @param {CustomSelectConfig} config */
    setStateFlags(config) {
        const { root, clearButton, moreButton, toggleButton } = this.#els;
        const disabled = config.disabled === true;
        const readonly = config.readonly === true;
        root.classList.toggle('csel-root--disabled', disabled);
        root.classList.toggle('csel-root--readonly', readonly);
        root.classList.toggle('csel-root--loading', config.loading === true);
        root.setAttribute('aria-disabled', String(disabled));
        if (disabled) root.removeAttribute('tabindex');
        else root.tabIndex = 0;
        toggleButton.disabled = disabled;
        const lockButtons = disabled || readonly;
        clearButton.disabled = lockButtons;
        moreButton.disabled = disabled;
        for (const btn of this.#tagRemoveButtons) btn.disabled = lockButtons;
    }

    disposeMain() {
        this.#els.root?.remove();
        this.#els = {};
        this.#tagRemoveButtons.clear();
    }
}
```

- [ ] **Step 4: Run → PASS**

Run: `npm run test:unit`

- [ ] **Step 5: Commit**

```bash
git add src/core/DomRenderer.js tests/unit/DomRenderer.helpers.test.js && git commit -m "feat: DomRenderer main module + grouping/accessibility helpers"
```

---

### Task 12: DomRenderer — popover и listbox

**Files:**
- Modify: `src/core/DomRenderer.js` (добавить приватные поля и методы в класс)

**Interfaces:**
- Produces (добавляется к DomRenderer; используется фасадом):
  - `ensurePopover(config): PopoverRefs` — создаёт ОДНОКРАТНО `<div popover="manual" id="${instanceId}-popover" class="csel-popover">`, монтирует в `document.body`. Структура: `.csel-search-header` (`.csel-search-icon`, `input.csel-search-input[type=search]`, `button.csel-search-clear`), `.csel-batch` (`button.csel-select-all`, `button.csel-clear-all`), `[role=listbox].csel-listbox` (`tabindex=-1`), `.csel-status`. Refs: `{popover, searchInput, searchClear, selectAllButton, clearAllButton, listbox, statusBox}`;
  - `getPopover(): HTMLElement`;
  - `applyPopoverConfig(config)` — видимость search/batch по конфигу, disabled при readonly/loading;
  - `renderList(matched, ctx)` — полная перестройка listbox через fragment: `groupItems`, пустые группы не рендерят header, опции `role="option"` c DOM-id `${instanceId}-opt-${index}` (index — позиция среди опций), классы `csel-option[--disabled/--selected]`, чекбокс-визуал `.csel-checkbox` только при multiple, подсветка через `highlightSegments` (text-узлы + `mark.csel-hl`), img для image-опций; заполняет `#navOptions`; восстанавливает activeId из ctx если опция существует;
  - `getNavModel(): NavModel` — `{options: #navOptions, rowCount: #navRowCount, activeId}`;
  - `setNavRowCount(rows|null)`;
  - `setActiveOption(itemId|null)` — класс `--active`, `aria-activedescendant` на якоре;
  - `getAnchorElement(config)` — searchInput при searchable, иначе listbox;
  - `updateOptionStates(selectedSet)` — частично обновляет aria-selected/классы/чекбоксы существующих опций без перестройки;
  - `renderStatus(kind, config)` — `'loading'` → spinner-div; `'empty-list'` → emptyListText; `'empty-search'` → emptySearchText; скрывает listbox при статусе;
  - `setQueryInputValue(q)`, `focusSearch()`, `focusListbox()`;
  - `saveScrollLeft()/restoreScrollLeft(x)`;
  - `disposePopover()`.
  - Поля: `#popoverRefs=null`, `#navOptions=[]`, `#navRowCount=null`, `#activeItemId=null`.

DOM-код проверяется интеграционными тестами Task 19; юнит-шаг здесь — typecheck.

- [ ] **Step 1: Добавить методы в класс DomRenderer**

```js
    /** @type {{popover: HTMLElement, searchInput: HTMLInputElement, searchClear: HTMLButtonElement,
     *          selectAllButton: HTMLButtonElement, clearAllButton: HTMLButtonElement,
     *          listbox: HTMLElement, statusBox: HTMLElement} | null} */
    #popoverRefs = null;
    /** @type {Array<{id: string|number, disabled: boolean, element: HTMLElement}>} */
    #navOptions = [];
    /** @type {number|null} */
    #navRowCount = null;
    /** @type {string|number|null} */
    #activeItemId = null;

    /**
     * @param {CustomSelectConfig} config
     */
    ensurePopover(config) {
        if (this.#popoverRefs) return this.#popoverRefs;

        const popover = document.createElement('div');
        popover.id = `${this.#instanceId}-popover`;
        popover.setAttribute('popover', 'manual');
        popover.className = 'csel-popover';

        const searchHeader = document.createElement('div');
        searchHeader.className = 'csel-search-header';
        const searchIcon = document.createElement('span');
        searchIcon.className = 'csel-search-icon';
        searchIcon.textContent = '⌕';
        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.className = 'csel-search-input';
        const searchClear = document.createElement('button');
        searchClear.type = 'button';
        searchClear.className = 'csel-search-clear';
        searchClear.textContent = '×';
        searchClear.tabIndex = -1;
        searchClear.hidden = true;
        searchHeader.append(searchIcon, searchInput, searchClear);

        const batchBar = document.createElement('div');
        batchBar.className = 'csel-batch';
        const selectAllButton = document.createElement('button');
        selectAllButton.type = 'button';
        selectAllButton.className = 'csel-select-all';
        selectAllButton.textContent = 'Выбрать всё';
        selectAllButton.tabIndex = -1;
        const clearAllButton = document.createElement('button');
        clearAllButton.type = 'button';
        clearAllButton.className = 'csel-clear-all';
        clearAllButton.textContent = 'Снять всё';
        clearAllButton.tabIndex = -1;
        batchBar.append(selectAllButton, clearAllButton);

        const listbox = document.createElement('div');
        listbox.className = 'csel-listbox';
        listbox.setAttribute('role', 'listbox');
        listbox.tabIndex = -1;

        const statusBox = document.createElement('div');
        statusBox.className = 'csel-status';
        statusBox.hidden = true;

        popover.append(searchHeader, batchBar, listbox, statusBox);
        document.body.append(popover);

        this.#popoverRefs = { popover, searchHeader, searchInput, searchClear, selectAllButton, clearAllButton, listbox, statusBox };
        this.applyPopoverConfig(config);
        return this.#popoverRefs;
    }

    /** @returns {HTMLElement} */
    getPopover() {
        if (!this.#popoverRefs) throw new Error('Popover is not created yet.');
        return this.#popoverRefs.popover;
    }

    /** @param {CustomSelectConfig} config */
    applyPopoverConfig(config) {
        if (!this.#popoverRefs) return;
        const { searchHeader, searchInput, selectAllButton, clearAllButton } = this.#popoverRefs;
        searchHeader.hidden = config.searchable !== true;
        searchInput.disabled = config.loading === true || config.disabled === true;
        const lockActions = config.disabled === true || config.readonly === true || config.loading === true;
        selectAllButton.hidden = !(config.multiple === true && config.showSelectAll === true);
        clearAllButton.hidden = !(config.multiple === true && config.showClearAll === true);
        selectAllButton.disabled = lockActions;
        clearAllButton.disabled = lockActions;
    }

    /**
     * Полная перестройка списка опций.
     * @param {CustomSelectItem[]} matched
     * @param {Object} ctx
     * @param {string} ctx.query
     * @param {string|number|null} ctx.activeId
     * @param {boolean} ctx.multiple
     * @param {Set<string|number>} ctx.selectedIds
     * @param {boolean} ctx.highlight
     * @param {import('../core/SearchEngine.js').SearchModeLike} ctx.searchMode
     * @param {boolean} ctx.searchCaseSensitive
     */
    renderList(matched, ctx) {
        if (!this.#popoverRefs) return;
        const { listbox } = this.#popoverRefs;
        const scrollLeft = listbox.scrollLeft;
        listbox.replaceChildren();
        this.#navOptions = [];
        this.#activeItemId = null;

        const frag = document.createDocumentFragment();
        let optionIndex = 0;
        const tokens = tokenize(ctx.query);
        const showHighlight = ctx.highlight && tokens.length > 0 && ctx.searchMode !== undefined;

        for (const group of groupItems(matched)) {
            if (group.name !== null) {
                const header = document.createElement('div');
                header.className = 'csel-group-header';
                header.textContent = group.name;
                frag.append(header);
            }
            for (const item of group.items) {
                frag.append(this.#buildOption(item, {
                    optionIndex,
                    multiple: ctx.multiple,
                    selected: ctx.selectedIds.has(item.id),
                    showHighlight,
                    tokens,
                    searchMode: ctx.searchMode ?? 'contains',
                    caseSensitive: ctx.searchCaseSensitive,
                }));
                this.#navOptions.push({
                    id: item.id,
                    disabled: item.disabled === true,
                    element: /** @type {HTMLElement} */ (frag.lastElementChild),
                });
                optionIndex += 1;
            }
        }
        listbox.append(frag);

        if (ctx.activeId !== null && matched.some((i) => i.id === ctx.activeId && i.disabled !== true)) {
            this.setActiveOption(ctx.activeId, { searchable: ctx.searchable === true });
        }
        listbox.scrollLeft = Math.min(scrollLeft, Math.max(0, listbox.scrollWidth - listbox.clientWidth));
    }

    /**
     * @param {CustomSelectItem} item
     * @param {Object} p
     * @param {number} p.optionIndex
     * @param {boolean} p.multiple
     * @param {boolean} p.selected
     * @param {boolean} p.showHighlight
     * @param {string[]} p.tokens
     * @param {SearchMode} p.searchMode
     * @param {boolean} p.caseSensitive
     * @returns {HTMLElement}
     */
    #buildOption(item, p) {
        const el = document.createElement('div');
        el.className = 'csel-option';
        el.id = `${this.#instanceId}-opt-${p.optionIndex}`;
        el.setAttribute('role', 'option');
        el.dataset.id = String(item.id);
        el.setAttribute('aria-selected', String(p.selected));
        if (item.disabled === true) {
            el.classList.add('csel-option--disabled');
            el.setAttribute('aria-disabled', 'true');
        }
        if (p.selected) el.classList.add('csel-option--selected');

        if (p.multiple) {
            const checkbox = document.createElement('span');
            checkbox.className = 'csel-checkbox';
            checkbox.setAttribute('aria-hidden', 'true');
            el.append(checkbox);
        }

        const content = document.createElement('span');
        content.className = 'csel-option-content';
        if (item.type === 'image') {
            const media = document.createElement('span');
            media.className = 'csel-option-media';
            const img = document.createElement('img');
            img.src = item.content;
            img.className = 'csel-img';
            media.append(img);
            content.append(media);
            const label = document.createElement('span');
            label.className = 'csel-option-label';
            label.textContent = accessibleName(item);
            content.append(label);
        } else if (p.showHighlight) {
            for (const seg of highlightSegments(item.content, p.tokens, { searchMode: p.searchMode, searchCaseSensitive: p.caseSensitive })) {
                if (seg.match) {
                    const mark = document.createElement('mark');
                    mark.className = 'csel-hl';
                    mark.textContent = seg.text;
                    content.append(mark);
                } else {
                    content.append(document.createTextNode(seg.text));
                }
            }
        } else {
            content.append(document.createTextNode(item.content));
        }
        el.append(content);
        el.title = item.type === 'text' ? item.content : accessibleName(item);
        return el;
    }

    /** @returns {NavModel} */
    getNavModel() {
        return { options: [...this.#navOptions], rowCount: this.#navRowCount, activeId: this.#activeItemId };
    }

    /** @param {number|null} rows */
    setNavRowCount(rows) {
        this.#navRowCount = rows;
    }

    /**
     * @param {string|number|null} itemId
     * @param {{searchable: boolean}} cfg
     * @returns {boolean} изменилось ли
     */
    setActiveOption(itemId, cfg) {
        if (!this.#popoverRefs) return false;
        const prev = this.#activeItemId;
        if (prev !== null) {
            const prevEl = this.#navOptions.find((o) => o.id === prev)?.element;
            prevEl?.classList.remove('csel-option--active');
        }
        this.#activeItemId = itemId;
        const anchor = this.getAnchorElement(cfg);
        if (itemId === null) {
            anchor.removeAttribute('aria-activedescendant');
            return prev !== null;
        }
        const nextEl = this.#navOptions.find((o) => o.id === itemId)?.element;
        nextEl?.classList.add('csel-option--active');
        nextEl?.scrollIntoView?.({ block: 'nearest' });
        anchor.setAttribute('aria-activedescendant', `${this.#instanceId}-opt-${this.#navOptions.findIndex((o) => o.id === itemId)}`);
        return true;
    }

    /**
     * Якорь aria-activedescendant и DOM-фокуса.
     * @param {{searchable: boolean}} config
     * @returns {HTMLElement}
     */
    getAnchorElement(config) {
        if (!this.#popoverRefs) throw new Error('Popover is not created yet.');
        return config.searchable ? this.#popoverRefs.searchInput : this.#popoverRefs.listbox;
    }

    /**
     * Частичное обновление состояния выбора без перестройки списка.
     * @param {Set<string|number>} selectedSet
     */
    updateOptionStates(selectedSet) {
        if (!this.#popoverRefs) return;
        for (const nav of this.#navOptions) {
            const isSelected = selectedSet.has(nav.id);
            nav.element.classList.toggle('csel-option--selected', isSelected);
            nav.element.setAttribute('aria-selected', String(isSelected));
        }
    }

    /**
     * @param {'loading'|'empty-list'|'empty-search'} kind
     * @param {CustomSelectConfig} config
     */
    renderStatus(kind, config) {
        if (!this.#popoverRefs) return;
        const { statusBox, listbox } = this.#popoverRefs;
        statusBox.replaceChildren();
        if (kind === 'loading') {
            const spinner = document.createElement('div');
            spinner.className = 'csel-spinner';
            spinner.setAttribute('role', 'status');
            spinner.setAttribute('aria-label', 'Загрузка');
            statusBox.append(spinner);
        } else {
            const text = kind === 'empty-list' ? config.emptyListText : config.emptySearchText;
            const div = document.createElement('div');
            div.className = 'csel-empty';
            div.textContent = text;
            statusBox.append(div);
        }
        statusBox.hidden = false;
        listbox.hidden = true;
    }

    clearStatus() {
        if (!this.#popoverRefs) return;
        this.#popoverRefs.statusBox.hidden = true;
        this.#popoverRefs.listbox.hidden = false;
    }

    /** @param {string} q */
    setQueryInputValue(q) {
        if (this.#popoverRefs) this.#popoverRefs.searchInput.value = q;
    }

    focusSearch() {
        this.#popoverRefs?.searchInput.focus();
    }

    focusListbox() {
        this.#popoverRefs?.listbox.focus();
    }

    /** @returns {number} */
    saveScrollLeft() {
        return this.#popoverRefs?.listbox.scrollLeft ?? 0;
    }

    /** @param {number} x */
    restoreScrollLeft(x) {
        if (this.#popoverRefs) this.#popoverRefs.listbox.scrollLeft = x;
    }

    disposePopover() {
        this.#popoverRefs?.popover.remove();
        this.#popoverRefs = null;
        this.#navOptions = [];
        this.#activeItemId = null;
    }
```

Вверху файла добавить импорты:

```js
import { tokenize, highlightSegments } from './SearchEngine.js';
```

И typedef-алиасы: `/** @typedef {import('./SearchEngine.js').NavOption} NavOption */` недоступен — NavOption/NavModel определены в KeyboardNav.js; добавить в SearchEngine.js экспорт типов не требуется — использовать локальные typedef:

```js
/**
 * @typedef {{id: string|number, disabled: boolean, element: HTMLElement}} RendererNavOption
 * @typedef {{options: RendererNavOption[], rowCount: number|null, activeId: string|number|null}} RendererNavModel
 */
```
и использовать их в сигнатурах `getNavModel(): RendererNavModel`.

Также в `renderList` параметр `ctx` дополняется полем `searchable: boolean` (фасад передаёт актуальный флаг) — оно используется в вызове `setActiveOption` выше. Сигнатура `setActiveOption(itemId, cfg)` уже финальная: якорь определяется конфигом, а не эвристикой.

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS (DOM API доступны благодаря lib DOM)

- [ ] **Step 3: Run unit suite**

Run: `npm run test:unit`
Expected: PASS (регрессий нет)

- [ ] **Step 4: Commit**

```bash
git add src/core/DomRenderer.js && git commit -m "feat: DomRenderer popover/listbox rendering"
```

---

### Task 13: CSS — тёмная тема, layout, анимации

**Files:**
- Modify: `src/styles/variables.css`, `src/styles/main-module.css`, `src/styles/modal-module.css`, `src/styles/animations.css`, `src/styles/index.css`

**Interfaces:**
- Consumes: все классы из Tasks 11–12 (`csel-root`, `csel-value-text`, `csel-placeholder`, `csel-tags`, `csel-tag`, `csel-tag-remove`, `csel-more`, `csel-clear`, `csel-toggle`, `csel-chevron`, `csel-img`, `csel-popover`, `csel-search-*`, `csel-batch`, `csel-select-all`, `csel-clear-all`, `csel-listbox`, `csel-group-header`, `csel-option[--disabled/--selected/--active]`, `csel-checkbox`, `csel-option-media`, `csel-option-label`, `csel-hl`, `csel-status`, `csel-empty`, `csel-spinner`).
- Produces: визуальная тема спеки §61–62; многоколоночная сетка `grid-auto-flow: column`; горизонтальный overflow; фиксированная высота опций из `--csel-line-height`; анимации через `@starting-style`+`allow-discrete` с учётом `prefers-reduced-motion`.
- Contract с фасадом: фасад выставляет inline-переменные на root/popover: `--csel-line-height`, `--csel-main-width`, `--csel-modal-width`, `--csel-modal-max-height`, `--csel-columns`, `--csel-column-gap`; класс `csel-no-animations` на popover когда `animations=false`.

- [ ] **Step 1: variables.css**

```css
:root {
    --csel-bg-main: #18181b;
    --csel-bg-hover: #27272a;
    --csel-bg-modal: #121214;
    --csel-border: #3f3f46;
    --csel-border-focus: #6366f1;
    --csel-text: #f4f4f5;
    --csel-text-muted: #a1a1aa;
    --csel-accent: #6366f1;
    --csel-accent-hover: #4f46e5;
    --csel-tag-bg: #27272a;
    --csel-tag-border: #52525b;
    --csel-divider: #27272a;
    --csel-radius: 6px;
    --csel-transition: 0.15s ease-in-out;
    /* runtime-инъекции фасада (значения по умолчанию) */
    --csel-line-height: 36px;
    --csel-main-width: 100%;
    --csel-modal-max-height: 320px;
    --csel-columns: 1;
    --csel-column-gap: 8px;
}
```

- [ ] **Step 2: main-module.css**

```css
.csel-root {
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    width: var(--csel-main-width);
    min-height: var(--csel-line-height);
    padding: 2px 30px 2px 8px;
    background: var(--csel-bg-main);
    border: 1px solid var(--csel-border);
    border-radius: var(--csel-radius);
    color: var(--csel-text);
    cursor: pointer;
    position: relative;
    transition: border-color var(--csel-transition);
}
.csel-root:hover { border-color: var(--csel-text-muted); }
.csel-root:focus-visible,
.csel-root:focus-within { outline: none; border-color: var(--csel-border-focus); }
.csel-root--disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
.csel-root--readonly .csel-clear,
.csel-root--readonly .csel-tag-remove { display: none; }

.csel-value-area {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    max-height: calc(var(--csel-line-height) * var(--csel-max-lines, 1));
    flex: 1;
    min-width: 0;
}

.csel-value-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.csel-placeholder { color: var(--csel-text-muted); pointer-events: none; }

.csel-tags { display: contents; }
.csel-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: calc(var(--csel-line-height) - 8px);
    padding: 0 4px 0 8px;
    background: var(--csel-tag-bg);
    border: 1px solid var(--csel-tag-border);
    border-radius: var(--csel-radius);
    font-size: 13px;
    white-space: nowrap;
}
.csel-tag-content { overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.csel-tag-remove {
    all: unset;
    cursor: pointer;
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--csel-text-muted);
}
.csel-tag-remove:hover { background: var(--csel-bg-hover); color: var(--csel-text); }
.csel-tag-remove:disabled { opacity: 0.4; cursor: default; }

.csel-more {
    all: unset;
    cursor: pointer;
    padding: 0 6px;
    color: var(--csel-text-muted);
    font-weight: 600;
    border-radius: 4px;
}
.csel-more:hover { color: var(--csel-text); background: var(--csel-bg-hover); }
.csel-more:disabled { opacity: 0.4; }

.csel-clear {
    all: unset;
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--csel-text-muted);
}
.csel-clear:hover { color: var(--csel-text); background: var(--csel-bg-hover); }
.csel-clear:disabled { opacity: 0.4; cursor: default; }

.csel-toggle {
    all: unset;
    position: absolute;
    right: 6px;
    top: 50%;
    translate: 0 -50%;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--csel-text-muted);
    border-radius: 4px;
    cursor: pointer;
}
.csel-toggle:hover { color: var(--csel-text); }
.csel-toggle[aria-expanded='true'] .csel-chevron { transform: rotate(180deg); }
.csel-toggle:disabled { opacity: 0.4; cursor: default; }
.csel-chevron { transition: transform var(--csel-transition); }

.csel-img { max-height: calc(var(--csel-line-height) - 12px); max-width: 100%; object-fit: contain; }
```

- [ ] **Step 3: modal-module.css**

```css
.csel-popover {
    position: fixed;
    inset: auto;
    margin: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: var(--csel-modal-width, auto);
    min-width: var(--csel-trigger-min-width, 0px);
    max-height: min(var(--csel-modal-max-height), calc(100vh - 16px));
    background: var(--csel-bg-modal);
    border: 1px solid var(--csel-border);
    border-radius: var(--csel-radius);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    color: var(--csel-text);
    z-index: 2147483000;
}
.csel-popover:not(:popover-open) { display: none; }

.csel-search-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border-bottom: 1px solid var(--csel-divider);
}
.csel-search-icon { color: var(--csel-text-muted); }
.csel-search-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--csel-text);
    font-size: 14px;
    height: var(--csel-line-height);
}
.csel-search-input::placeholder { color: var(--csel-text-muted); }
.csel-search-input:disabled { opacity: 0.5; }
.csel-search-clear {
    all: unset;
    cursor: pointer;
    width: 20px;
    height: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--csel-text-muted);
}
.csel-search-clear:hover { color: var(--csel-text); background: var(--csel-bg-hover); }

.csel-batch {
    display: flex;
    gap: 6px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--csel-divider);
}
.csel-select-all,
.csel-clear-all {
    all: unset;
    cursor: pointer;
    padding: 4px 10px;
    font-size: 13px;
    border-radius: 4px;
    color: var(--csel-text-muted);
    border: 1px solid var(--csel-border);
}
.csel-select-all:hover:not(:disabled),
.csel-clear-all:hover:not(:disabled) {
    color: var(--csel-text);
    border-color: var(--csel-accent);
    background: var(--csel-bg-hover);
}
.csel-select-all:disabled,
.csel-clear-all:disabled { opacity: 0.4; cursor: default; }

.csel-listbox {
    overflow-x: auto;
    overflow-y: hidden;
    padding: 4px;
    display: grid;
    grid-template-columns: repeat(var(--csel-columns), minmax(var(--csel-column-width, 160px), 1fr));
    grid-auto-flow: column;
    column-gap: var(--csel-column-gap);
    align-content: start;
}
.csel-listbox:focus-visible { outline: 2px solid var(--csel-border-focus); outline-offset: -2px; }

.csel-group-header {
    grid-column: 1 / -1;
    padding: 8px 6px 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--csel-text-muted);
    user-select: none;
}

.csel-option {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--csel-line-height);
    padding: 0 8px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    overflow: hidden;
}
.csel-option:hover:not(.csel-option--disabled),
.csel-option--active:not(.csel-option--disabled) { background: var(--csel-bg-hover); }
.csel-option--selected { color: var(--csel-accent); }
.csel-option--disabled { opacity: 0.45; cursor: not-allowed; }
.csel-option-content { overflow: hidden; text-overflow: ellipsis; }

.csel-checkbox {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    border: 1px solid var(--csel-tag-border);
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
    color: transparent;
}
.csel-option--selected .csel-checkbox {
    background: var(--csel-accent);
    border-color: var(--csel-accent-hover);
    color: #fff;
}
.csel-option--selected .csel-checkbox::after { content: '✓'; }

.csel-option-media {
    display: inline-flex;
    height: calc(var(--csel-line-height) - 12px);
    width: calc(var(--csel-line-height) - 12px);
    flex: 0 0 auto;
}
.csel-option-label { overflow: hidden; text-overflow: ellipsis; }

.csel-hl { background: var(--csel-accent); color: #fff; border-radius: 2px; padding: 0 1px; }

.csel-status { padding: 16px; }
.csel-empty { color: var(--csel-text-muted); text-align: center; padding: 8px 0; }
.csel-spinner {
    width: 24px;
    height: 24px;
    margin: 8px auto;
    border-radius: 50%;
    border: 2px solid var(--csel-border);
    border-top-color: var(--csel-accent);
    animation: csel-spin 0.7s linear infinite;
}
@keyframes csel-spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 4: animations.css**

```css
@media (prefers-reduced-motion: no-preference) {
    .csel-popover[data-csel-anim='true']:popover-open {
        animation: csel-pop-in var(--csel-transition) ease-out;
    }
}

@keyframes csel-pop-in {
    from {
        opacity: 0;
        transform: translateY(-4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

Фасад ставит `popover.dataset.cselAnim = 'true'|'false'` по конфигу `animations` (и убирает атрибут при reduced motion — CSS-медиа уже страхует).

- [ ] **Step 5: index.css**

```css
@import './variables.css';
@import './main-module.css';
@import './modal-module.css';
@import './animations.css';
```

- [ ] **Step 6: Гейты**

Run: `npm run build && npm run typecheck && npm run test:unit`
Expected: PASS; в `dist/` появляется `index.css`.

- [ ] **Step 7: Commit**

```bash
git add src/styles && git commit -m "feat: dark theme CSS, multi-column grid, popover animations"
```

---

### Task 14: CustomSelect — фасад (полный класс)

**Files:**
- Create: `src/core/CustomSelect.js`

**Interfaces:**
- Consumes: все модули из Tasks 3–12 (`nextInstanceId`, `ConfigManager`+`validateItems`, `StateManager`, `EventEmitter`, `DomRenderer`, `calculatePlacement`, `ProximityEngine`, `KeyboardNav`, `search`).
- Produces: `default class CustomSelect` с публичным API спеки §63: `constructor(target, config, events)`, `async open()/close()/toggle()`, `async updateConfig(patch)`, `async setItems(items)`, `async setValue(ids)`, `getValue()`, `async clear()`, `async selectAll()`, `on(event,handler)`, `off(event,handler)`, `destroy()`. Имена событий эмиттера: `'select'|'deselect'|'change'|'open'|'close'|'search'|'clear'`.
- Проверка на этом шаге: `npm run typecheck` + `npm run build` + регресс `npm run test:unit` (поведенческая верификация фасада — интеграционные тесты Task 17).

- [ ] **Step 1: Каркас файла — импорты, typedefs, поля класса**

```js
import ConfigManager, { validateItems } from './ConfigManager.js';
import StateManager from './StateManager.js';
import EventEmitter from './EventEmitter.js';
import DomRenderer, { accessibleName, groupItems } from './DomRenderer.js';
import { calculatePlacement } from './PositionEngine.js';
import ProximityEngine from './ProximityEngine.js';
import KeyboardNav from './KeyboardNav.js';
import { nextInstanceId } from './InstanceId.js';
import { search } from './SearchEngine.js';

/**
 * @typedef {import('../types.js').CustomSelectItem} CustomSelectItem
 * @typedef {import('../types.js').CustomSelectConfig} CustomSelectConfig
 * @typedef {import('../types.js').SelectEvents} SelectEvents
 * @typedef {import('../types.js').SimpleRect} SimpleRect
 */

const EVENT_ALIASES = /** @type {const} */ ({
    onSelect: 'select',
    onDeselect: 'deselect',
    onChange: 'change',
    onOpen: 'open',
    onClose: 'close',
    onSearch: 'search',
    onClear: 'clear',
});

/**
 * @param {DOMRect} r
 * @returns {SimpleRect}
 */
function toRect(r) {
    return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export default class CustomSelect {
    #instanceId;
    /** @type {HTMLElement} */
    #target;
    /** @type {ConfigManager} */
    #configManager;
    /** @type {StateManager} */
    #state;
    /** @type {EventEmitter} */
    #emitter = new EventEmitter();
    /** @type {DomRenderer} */
    #renderer;
    /** @type {KeyboardNav} */
    #keyboardNav;
    /** @type {'closed'|'opening'|'open'|'closing'|'destroyed'} */
    #openState = 'closed';
    #query = '';
    /** @type {string|number|null} */
    #activeId = null;
    /** @type {'pointer'|'arrow-down'|'arrow-up'} */
    #openIntent = 'pointer';
    /** @type {Promise<void>} */
    #transition = Promise.resolve();
    #destroyed = false;
    /** @type {ProximityEngine|null} */
    #proximity = null;
    /** @type {ResizeObserver|null} */
    #resizeObserver = null;
    #repositionRafId = 0;
    /** @type {Array<()=>void>} */
    #disposables = [];
    /** @type {CustomSelectItem[]} */
    #lastMatched = [];
```

- [ ] **Step 2: Конструктор + регистрация событий + каркас main-модуля и popover**

```js
    /**
     * @param {HTMLElement|string} target
     * @param {CustomSelectConfig} config
     * @param {SelectEvents} [events]
     */
    constructor(target, config, events) {
        if (typeof HTMLElement === 'undefined' || typeof HTMLElement.prototype.showPopover !== 'function') {
            throw new DOMException(
                'CustomSelect requires the HTML Popover API, which is missing in this browser.',
                'NotSupportedError',
            );
        }

        /** @type {HTMLElement} */
        let el;
        if (typeof target === 'string') {
            const matches = Array.from(document.querySelectorAll(target));
            if (matches.length === 0) throw new Error(`Target selector "${target}" matched no elements.`);
            if (matches.length > 1) throw new Error(`Target selector "${target}" matched ${matches.length} elements; expected exactly one.`);
            el = /** @type {HTMLElement} */ (matches[0]);
        } else if (target instanceof HTMLElement) {
            el = target;
        } else {
            throw new TypeError('Invalid target: expected HTMLElement or selector string.');
        }
        this.#target = el;

        const items = validateItems(config?.items ?? []);
        this.#instanceId = nextInstanceId();
        this.#configManager = new ConfigManager(config);
        this.#state = new StateManager({
            items,
            selectedIds: config?.selectedIds ?? [],
            multiple: this.#configManager.config.multiple,
        });

        if (events) {
            for (const [alias, eventName] of Object.entries(EVENT_ALIASES)) {
                const handler = /** @type {Record<string, undefined|Function>} */ (events)[alias];
                if (typeof handler === 'function') this.#emitter.on(eventName, handler);
            }
        }

        this.#renderer = new DomRenderer({ instanceId: this.#instanceId });
        const cfg = this.#configManager.config;
        this.#renderer.renderMain(this.#target, cfg);
        this.#renderer.ensurePopover(cfg);
        this.#renderer.applyPopoverConfig(cfg);
        this.#applyGeometryVars();
        this.#renderer.setStateFlags(cfg);
        this.#syncMainView();
        this.#wireMainEvents();
        this.#wirePopoverEvents();
        this.#setupKeyboardNav();
        this.#observeResize();
    }
```

- [ ] **Step 3: Приватные помощники — геометрия, вью синк, обработчики main/popover**

```js
    #assertAlive() {
        if (this.#destroyed || this.#openState === 'destroyed') {
            throw new Error('CustomSelect instance has been destroyed.');
        }
    }

    #cfg() {
        return this.#configManager.config;
    }

    #applyGeometryVars() {
        const c = this.#cfg();
        const rootStyle = this.#renderer.elements.root.style;
        rootStyle.setProperty('--csel-line-height', `${c.lineHeight}px`);
        rootStyle.setProperty('--csel-main-width', typeof c.mainWidth === 'number' ? `${c.mainWidth}px` : c.mainWidth);
        rootStyle.setProperty('--csel-max-lines', String(c.maxLines));
        const pop = this.#renderer.getPopover();
        pop.style.setProperty('--csel-line-height', `${c.lineHeight}px`);
        pop.style.setProperty('--csel-columns', String(c.columns));
        pop.style.setProperty('--csel-column-gap', `${c.columnGap}px`);
        pop.style.setProperty('--csel-modal-max-height', `${c.modalMaxHeight}px`);
        pop.style.setProperty('--csel-modal-width',
            c.modalWidth === 'auto' ? 'auto' : typeof c.modalWidth === 'number' ? `${c.modalWidth}px` : c.modalWidth);
        pop.dataset.cselAnim = c.animations ? 'true' : 'false';
    }

    /** Перерисовывает значение/теги основного модуля из состояния. */
    #syncMainView() {
        const c = this.#cfg();
        const selected = this.#state.getSelectedItems();
        if (c.multiple) {
            this.#renderer.renderValue(null, c);
            this.#renderer.renderTags(selected, c);
            this.#recalcTags();
        } else {
            this.#renderer.renderTags([], c);
            this.#renderer.renderValue(selected[0] ?? null, c);
            this.#renderer.setMoreVisible(false);
        }
        this.#renderer.setClearVisible(c.showClearAll && selected.length > 0);
        this.#renderer.setStateFlags(c);
    }

    /** Текущие видимые опции после поиска/фильтров. @returns {CustomSelectItem[]} */
    #computeMatched() {
        const c = this.#cfg();
        let matched = search(this.#state.getItems(), this.#query, {
            searchMode: c.searchMode,
            searchCaseSensitive: c.searchCaseSensitive,
        });
        if (c.showSelectedItems === false) {
            const sel = new Set(this.#state.getSelectedIds());
            matched = matched.filter((i) => !sel.has(i.id));
        }
        return matched;
    }

    /** Обновляет список/статус в открытом popover. */
    #refreshList() {
        const c = this.#cfg();
        this.#renderer.setQueryInputValue(this.#query);
        if (c.loading) {
            this.#renderer.renderStatus('loading', c);
            this.#lastMatched = [];
            return;
        }
        const matched = this.#computeMatched();
        this.#lastMatched = matched;
        if (matched.length === 0) {
            const kind = this.#state.getItems().length === 0 ? 'empty-list' : 'empty-search';
            this.#renderer.renderStatus(kind, c);
        } else {
            this.#renderer.clearStatus();
            this.#renderer.renderList(matched, {
                query: this.#query,
                activeId: this.#activeId,
                multiple: c.multiple,
                selectedIds: new Set(this.#state.getSelectedIds()),
                highlight: c.highlightSearchMatches,
                searchMode: c.searchMode,
                searchCaseSensitive: c.searchCaseSensitive,
                searchable: c.searchable === true,
            });
            this.#updateNavRows();
        }
    }

    /** Число строк сетки по фактической высоте списка (спека §43). */
    #updateNavRows() {
        const c = this.#cfg();
        if (c.columns <= 1) {
            this.#renderer.setNavRowCount(null);
            return;
        }
        const listbox = this.#renderer.getNavModel().options[0]?.element?.parentElement;
        const h = listbox?.clientHeight ?? c.lineHeight;
        const rows = Math.max(1, Math.floor(h / c.lineHeight));
        this.#renderer.setNavRowCount(rows);
    }

    #wireMainEvents() {
        const els = this.#renderer.elements;

        /** @param {Event} e */
        const onClick = (e) => {
            const evt = /** @type {MouseEvent} */ (e);
            const t = evt.target instanceof Element ? evt.target : null;
            if (!t) return;
            if (t.closest('.csel-tag-remove')) {
                evt.stopPropagation();
                const idAttr = /** @type {HTMLElement} */ (t.closest('.csel-tag-remove')).dataset.id;
                void this.#uiRemoveTag(this.#parseId(/** @type {string} */ (idAttr)));
                return;
            }
            if (t.closest('.csel-clear')) {
                evt.stopPropagation();
                void this.clear();
                return;
            }
            if (t.closest('.csel-toggle')) {
                evt.stopPropagation();
                this.#openIntent = 'pointer';
                void this.toggle();
                return;
            }
            this.#openIntent = 'pointer';
            void this.open();
        };

        /** @param {KeyboardEvent} e */
        const onKeyDown = (e) => {
            const c = this.#cfg();
            if (c.disabled) return;
            const onRootItself = e.target instanceof Element && e.target === els.root;
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    this.#openIntent = 'pointer';
                    void this.open();
                    break;
                case ' ':
                    if (!onRootItself) return;
                    e.preventDefault();
                    this.#openIntent = 'pointer';
                    void this.open();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.#openIntent = 'arrow-down';
                    void this.open();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.#openIntent = 'arrow-up';
                    void this.open();
                    break;
                case 'Backspace':
                    if (!onRootItself || !c.multiple || c.readonly || c.loading) return;
                    this.#uiRemoveLastTag();
                    break;
                case 'Escape':
                    if (this.#openState === 'open' || this.#openState === 'opening') void this.close();
                    break;
                default:
                    break;
            }
        };

        els.root.addEventListener('click', onClick);
        els.root.addEventListener('keydown', onKeyDown);
        this.#disposables.push(() => {
            els.root.removeEventListener('click', onClick);
            els.root.removeEventListener('keydown', onKeyDown);
        });
    }

    #wirePopoverEvents() {
        const refs = /** @type {{popover: HTMLElement, searchInput: HTMLInputElement, searchClear: HTMLButtonElement, selectAllButton: HTMLButtonElement, clearAllButton: HTMLButtonElement, listbox: HTMLElement}} */ (
            /** @type {unknown} */ (this.#renderer.ensurePopover(this.#cfg()))
        );

        /** @type {Function} */
        const onSearchInput = () => this.#onQueryChanged(refs.searchInput.value);

        /** @type {Function} */
        const onSearchClear = () => {
            refs.searchInput.value = '';
            this.#onQueryChanged('');
        };

        /** @type {Function} */
        const onSelectAllClick = () => void this.selectAll();

        /** @type {Function} */
        const onClearAllClick = () => void this.clear();

        /** @param {Event} e */
        const onListClick = (e) => {
            const t = e.target instanceof Element ? e.target.closest('[role="option"]') : null;
            if (!(t instanceof HTMLElement)) return;
            const id = this.#parseId(/** @type {string} */ (t.dataset.id));
            void this.#uiSelectIntent(id);
        };

        /**
         * Клавиатура на уровне popover: Escape из input тоже закрывает (спека §41),
         * ArrowDown из input уводит активность в список; остальное — KeyboardNav.
         * @param {KeyboardEvent} e
         */
        const onPopoverKeyDown = (e) => {
            const inInput = e.target instanceof HTMLElement && e.target.tagName === 'INPUT';
            if (inInput) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    void this.close();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const id = this.#firstEnabledNavId();
                    if (id !== null) {
                        this.#activeId = id;
                        this.#renderer.setActiveOption(id, { searchable: true });
                    }
                }
                return;
            }
            if (e.key === 'Tab') return;
            this.#keyboardNav.handleKeyDown(e);
        };

        refs.searchInput.addEventListener('input', onSearchInput);
        refs.searchClear.addEventListener('click', onSearchClear);
        refs.selectAllButton.addEventListener('click', onSelectAllClick);
        refs.clearAllButton.addEventListener('click', onClearAllClick);
        refs.listbox.addEventListener('click', onListClick);
        refs.popover.addEventListener('keydown', onPopoverKeyDown);

        this.#disposables.push(() => {
            refs.searchInput.removeEventListener('input', onSearchInput);
            refs.searchClear.removeEventListener('click', onSearchClear);
            refs.selectAllButton.removeEventListener('click', onSelectAllClick);
            refs.clearAllButton.removeEventListener('click', onClearAllClick);
            refs.listbox.removeEventListener('click', onListClick);
            refs.popover.removeEventListener('keydown', onPopoverKeyDown);
        });
    }

    #setupKeyboardNav() {
        this.#keyboardNav = new KeyboardNav({
            getModel: () => this.#renderer.getNavModel(),
            setActiveId: (id) => {
                this.#activeId = id;
                this.#renderer.setActiveOption(id, { searchable: this.#cfg().searchable === true });
            },
            onSelectIntent: (id) => void this.#uiSelectIntent(id),
            onRequestClose: () => void this.close(),
        });
    }

    #observeResize() {
        this.#resizeObserver = new ResizeObserver(() => {
            this.#syncMainView();
            this.#scheduleReposition();
        });
        this.#resizeObserver.observe(this.#renderer.elements.root);
    }

    /** @param {string} s @returns {string|number} */
    #parseId(s) {
        return /^-?\d+$/.test(s) ? Number(s) : s;
    }
```

Замечание к `#parseId`: числовые id сериализуются в dataset строкой; обратное преобразование восстанавливает number для чисто-числовых строк. Пограничный случай «строковый id "123"» неотличим от числа 123 в dataset — поэтому рендер опций использует тот же dataset.id из `String(item.id)` и сопоставление идёт через `#navOptions.find(o => String(o.id) === s)` в `#uiSelectIntent` (см. Step 4), где сравнение выполняется по строковой форме. `#parseId` используется только для tag-remove; для корректности там тоже применяется строковое сопоставление через состояние.

- [ ] **Step 4: Выбор/снятие/batch/query — пользовательские интенты и события**

```js
    /**
     * Клик/Enter по тегу-remove.
     * @param {string|number} idStr
     */
    async #uiRemoveTag(idStr) {
        const c = this.#cfg();
        if (c.disabled || c.readonly) return;
        const id = this.#resolveId(idStr);
        if (id === undefined) return;
        this.#mutateAndSync(() => this.#state.deselect(id), async () => {
            await this.#emitter.emit('deselect', /** @type {CustomSelectItem} */ (this.#state.getItem(id)));
            await this.#emitChange();
        }, { keepOpen: true });
    }

    #uiRemoveLastTag() {
        const ids = this.#state.getSelectedIds();
        const last = ids[ids.length - 1];
        if (last !== undefined) void this.#uiRemoveTag(last);
    }

    /**
     * Строковое/числовое сопоставление id с текущими items.
     * @param {string|number} ref
     * @returns {string|number|undefined}
     */
    #resolveId(ref) {
        const exact = this.#state.getItem(ref);
        if (exact) return exact.id;
        const byString = this.#state.getItems().find((i) => String(i.id) === String(ref));
        return byString?.id;
    }

    /**
     * Интент выбора из UI или клавиатуры.
     * @param {string|number} ref
     */
    async #uiSelectIntent(ref) {
        const c = this.#cfg();
        if (c.disabled || c.readonly || c.loading) return;
        const id = this.#resolveId(ref);
        if (id === undefined) return;
        const item = /** @type {CustomSelectItem} */ (this.#state.getItem(id));
        if (item.disabled === true) return;

        if (!c.multiple) {
            this.#mutateAndSync(() => this.#state.select(id), async () => {
                await this.#emitter.emit('select', item);
                await this.#emitChange();
            });
            await this.close();
            return;
        }

        const wasSelected = new Set(this.#state.getSelectedIds()).has(id);
        this.#mutateAndSync(() => this.#state.toggle(id), async () => {
            if (wasSelected) await this.#emitter.emit('deselect', item);
            else await this.#emitter.emit('select', item);
            await this.#emitChange();
        }, { keepOpen: true });
    }

    /**
     * Единая точка мутации: mutate → sync view (+list при keepOpen) → события.
     * Ошибки событий не влияют на уже применённое состояние (гарантия EventEmitter).
     * @param {() => void} mutate
     * @param {() => Promise<void>} [emitFn]
     * @param {{keepOpen?: boolean}} [opts]
     */
    #mutateAndSync(mutate, emitFn, opts = {}) {
        mutate();
        this.#syncMainView();
        if (opts.keepOpen === true && (this.#openState === 'open')) {
            this.#refreshListPreservingFocus();
        }
        void emitFn?.();
    }

    /** Обновление списка с сохранением query/active/scroll (спека §20). */
    #refreshListPreservingFocus() {
        const scrollLeft = this.#renderer.saveScrollLeft();
        const searchable = this.#cfg().searchable === true;
        this.#refreshList();
        this.#renderer.restoreScrollLeft(scrollLeft);
        if (this.#activeId !== null) {
            this.#renderer.setActiveOption(this.#activeId, { searchable });
        }
    }

    /** @returns {Promise<void>} */
    async #emitChange() {
        await this.#emitter.emit('change', this.#state.getSelectedItems());
    }

    /** @param {string} value */
    async #onQueryChanged(value) {
        const c = this.#cfg();
        if (c.disabled || c.loading) return;
        this.#query = value;
        const refs = this.#renderer;
        refs.setQueryInputValue(value);
        const searchClear = /** @type {HTMLElement} */ (document.querySelector(`#${this.#instanceId}-popover .csel-search-clear`));
        if (searchClear) searchClear.hidden = value.trim() === '';
        this.#refreshList();
        // Коррекция active: активная должна быть существующей enabled опцией (инвариант №13)
        if (this.#activeId !== null) {
            const stillThere = this.#renderer.getNavModel().options.some((o) => o.id === this.#activeId);
            if (!stillThere) this.#activeId = this.#firstEnabledNavId();
            if (this.#activeId !== null) refs.setActiveOption(this.#activeId, { searchable: c.searchable === true });
        }
        await this.#emitter.emit('search', this.#query, this.#lastMatched);
    }

    /** @returns {string|number|null} */
    #firstEnabledNavId() {
        const opts = this.#renderer.getNavModel().options;
        const found = opts.find((o) => !o.disabled);
        return found ? found.id : null;
    }

    /**
     * Массовый выбор: только по текущим результатам поиска при непустом query (спека §15).
     * @returns {Promise<void>}
     */
    async selectAll() {
        this.#assertAlive();
        const c = this.#cfg();
        if (!c.multiple) return;
        const candidates = this.#query.trim() === '' && this.#openState !== 'open'
            ? undefined
            : this.#lastMatched.filter((i) => i.disabled !== true).map((i) => i.id);
        this.#mutateAndSync(() => {
            this.#state.selectAll(candidates);
        }, async () => {
            await this.#emitChange();
        }, { keepOpen: true });
    }

    /** @returns {Promise<void>} */
    async clear() {
        this.#assertAlive();
        this.#mutateAndSync(() => {
            this.#state.clear();
        }, async () => {
            await this.#emitter.emit('clear');
            await this.#emitChange();
        }, { keepOpen: true });
    }
```

- [ ] **Step 5: Lifecycle open/close/toggle, позиционирование, proximity, outside-click**

```js
    /**
     * Сериализация конфликтующих переходов (спека §11).
     * @template T
     * @param {() => Promise<T>|T} fn
     * @returns {Promise<T>}
     */
    #enqueue(fn) {
        const run = this.#transition.then(fn);
        this.#transition = run.then(() => {}, () => {});
        return run;
    }

    /**
     * @param {HTMLElement} popover
     * @param {'open'|'closed'} expected
     * @returns {Promise<void>}
     */
    #awaitToggle(popover, expected) {
        return new Promise((resolve) => {
            /** @param {Event} ev */
            const handler = (ev) => {
                const state = /** @type {{newState?: string}} */ (ev).newState;
                if (state === expected || popover.matches(':popover-open') === (expected === 'open')) {
                    popover.removeEventListener('toggle', handler);
                    resolve();
                }
            };
            popover.addEventListener('toggle', handler);
        });
    }

    /** @returns {Promise<void>} */
    open() {
        this.#assertAlive();
        if (this.#cfg().disabled) return Promise.resolve();
        if (this.#openState === 'open') return Promise.resolve();
        if (this.#openState === 'opening') return this.#transition;
        return this.#enqueue(() => this.#openInternal());
    }

    async #openInternal() {
        if (this.#openState === 'open' || this.#openState === 'opening' || this.#destroyed) return;
        const c = this.#cfg();
        if (c.disabled) return;
        this.#openState = 'opening';
        this.#refreshList();
        this.#applyGeometryVars();
        const popover = this.#renderer.getPopover();
        this.#repositionNow();
        popover.showPopover();
        await this.#awaitToggle(popover, 'open');
        if (this.#destroyed) return;
        this.#openState = 'open';
        this.#activateListeners();
        this.#setExpanded(true);
        this.#applyInitialFocus();
        await this.#emitter.emit('open');
    }

    /** Начальный фокус/активность по матрице спеки §24 (решение №2). */
    #applyInitialFocus() {
        const c = this.#cfg();
        if (c.searchable && this.#openIntent === 'pointer') {
            this.#renderer.focusSearch();
            this.#activeId = null;
            this.#renderer.setActiveOption(null, { searchable: true });
            return;
        }
        const searchable = c.searchable === true;
        this.#renderer.focusListbox();
        const targetId = this.#openIntent === 'arrow-up'
            ? this.#lastEnabledNavId()
            : this.#firstEnabledNavId();
        this.#activeId = targetId;
        this.#renderer.setActiveOption(targetId, { searchable });
    }

    /** @returns {string|number|null} */
    #lastEnabledNavId() {
        const opts = this.#renderer.getNavModel().options;
        for (let i = opts.length - 1; i >= 0; i--) {
            const o = opts[i];
            if (o && !o.disabled) return o.id;
        }
        return null;
    }

    /** @returns {Promise<void>} */
    close() {
        this.#assertAlive();
        if (this.#openState === 'closed') return Promise.resolve();
        if (this.#openState === 'closing') return this.#transition;
        return this.#enqueue(() => this.#closeInternal());
    }

    async #closeInternal() {
        if (this.#openState === 'closed' || this.#openState === 'closing' || this.#destroyed) return;
        this.#openState = 'closing';
        this.#deactivateListeners();
        const popover = this.#renderer.getPopover();
        if (popover.matches(':popover-open')) popover.hidePopover();
        await this.#awaitToggle(popover, 'closed');
        this.#renderer.elements.toggleButton?.focus();
        this.#query = '';
        this.#renderer.setQueryInputValue('');
        this.#activeId = null;
        this.#renderer.setActiveOption(null, { searchable: false });
        this.#openState = 'closed';
        this.#setExpanded(false);
        await this.#emitter.emit('close');
    }

    /** @returns {Promise<void>} */
    toggle() {
        this.#assertAlive();
        if (this.#openState === 'open' || this.#openState === 'opening') return this.close();
        return this.open();
    }

    #setExpanded(expanded) {
        this.#renderer.elements.toggleButton.setAttribute('aria-expanded', String(expanded));
    }

    #activateListeners() {
        const rootEl = this.#renderer.elements.root;
        const popoverEl = this.#renderer.getPopover();

        /** @param {PointerEvent} e */
        const onDocPointerDown = (e) => {
            const path = e.composedPath();
            if (path.includes(rootEl) || path.includes(popoverEl)) return;
            void this.close();
        };
        document.addEventListener('pointerdown', onDocPointerDown, true);

        const onWinReposition = () => this.#scheduleReposition();
        window.addEventListener('resize', onWinReposition, { passive: true });
        window.addEventListener('scroll', onWinReposition, { capture: true, passive: true });

        const c = this.#cfg();
        this.#proximity = new ProximityEngine({
            threshold: c.cursorDistanceThreshold,
            getRects: () => ({
                main: toRect(rootEl.getBoundingClientRect()),
                popover: toRect(popoverEl.getBoundingClientRect()),
            }),
            onThresholdExceeded: () => void this.close(),
        });
        this.#proximity.attach();

        this.#disposables.push(
            () => document.removeEventListener('pointerdown', onDocPointerDown, true),
            () => window.removeEventListener('resize', onWinReposition),
            () => window.removeEventListener('scroll', onWinReposition, { capture: true }),
            () => this.#proximity?.detach(),
        );
    }

    #deactivateListeners() {
        for (const off of this.#disposables.splice(0)) off();
    }

    #scheduleReposition() {
        if (this.#repositionRafId) return;
        this.#repositionRafId = requestAnimationFrame(() => {
            this.#repositionRafId = 0;
            this.#repositionNow();
        });
    }

    #repositionNow() {
        if (this.#openState !== 'open' && this.#openState !== 'opening') return;
        const c = this.#cfg();
        const popover = this.#renderer.getPopover();
        const triggerRect = toRect(this.#renderer.elements.root.getBoundingClientRect());
        const placement = calculatePlacement(
            triggerRect,
            { left: 0, top: 0, width: popover.offsetWidth || 240, height: popover.offsetHeight || 120 },
            { width: window.innerWidth, height: window.innerHeight },
            { offset: c.modalOffset, maxHeight: c.modalMaxHeight },
        );
        popover.style.left = `${placement.left}px`;
        popover.style.top = `${placement.top}px`;
        popover.style.height = `${Math.round(placement.height)}px`;
        if (c.modalWidth === 'auto') {
            popover.style.width = `${Math.round(placement.width)}px`;
        }
        if (c.modalWidth === 'auto' && placement.width < triggerRect.width && triggerRect.width <= window.innerWidth - 16) {
            // min-width popover = ширина триггера (решение №12.3): расширяем через placement повторно
            const widened = calculatePlacement(
                triggerRect,
                { left: 0, top: 0, width: triggerRect.width, height: popover.offsetHeight || 120 },
                { width: window.innerWidth, height: window.innerHeight },
                { offset: c.modalOffset, maxHeight: c.modalMaxHeight },
            );
            popover.style.width = `${Math.round(widened.width)}px`;
        }
        popover.style.setProperty('--csel-trigger-min-width', `${Math.round(triggerRect.width)}px`);
        this.#updateNavRows();
    }
```

- [ ] **Step 6: maxLines-алгоритм, публичный sync/dynamic API, destroy**

```js
    /**
     * Алгоритм скрытия переполнения тегов (спека §25): два прохода измерений.
     */
    #recalcTags() {
        const c = this.#cfg();
        const { tagsContainer, moreButton } = this.#renderer.elements;
        const pills = /** @type {HTMLElement[]} */ ([...tagsContainer.querySelectorAll(':scope > .csel-tag')]);
        if (!c.multiple || pills.length === 0) {
            this.#renderer.setMoreVisible(false);
            return;
        }
        moreButton.hidden = true;
        tagsContainer.style.removeProperty('padding-right');

        /** @param {number} reservePx */
        const measureCutoff = (reservePx) => {
            tagsContainer.style.paddingRight = reservePx > 0 ? `${reservePx}px` : '0';
            const limitTop = c.lineHeight * c.maxLines;
            let cutoff = pills.length;
            let anyBeyond = false;
            pills.forEach((pill, i) => {
                const top = pill.offsetTop;
                const beyond = top + pill.offsetHeight > limitTop + 1;
                if (beyond) {
                    anyBeyond = true;
                    if (i < cutoff) cutoff = i;
                }
            });
            return { cutoff, anyBeyond };
        };

        let { cutoff, anyBeyond } = measureCutoff(0);
        if (anyBeyond) {
            // второй проход с зарезервированным местом под кнопку «...»
            moreButton.hidden = false;
            const reserve = moreButton.offsetWidth;
            ({ cutoff, anyBeyond } = measureCutoff(reserve));
        }
        pills.forEach((pill, i) => {
            pill.style.display = i < cutoff ? '' : 'none';
        });
        this.#renderer.setMoreVisible(anyBeyond && cutoff < pills.length);
    }

    /** @returns {CustomSelectItem[]} */
    getValue() {
        this.#assertAlive();
        return this.#state.getSelectedItems();
    }

    /** @param {(typeof EVENT_ALIASES)[keyof typeof EVENT_ALIASES]} event */
    on(event, handler) {
        this.#assertAlive();
        this.#emitter.on(event, handler);
    }

    /** @param {(typeof EVENT_ALIASES)[keyof typeof EVENT_ALIASES]} event */
    off(event, handler) {
        this.#assertAlive();
        this.#emitter.off(event, handler);
    }

    /**
     * Динамическая замена items (спека §16). Асинхронна из-за awaited событий.
     * @param {CustomSelectItem[]} newItems
     * @returns {Promise<void>}
     */
    async setItems(newItems) {
        this.#assertAlive();
        const removed = this.#state.setItems(validateItems(newItems));
        for (const item of removed) {
            await this.#emitter.emit('deselect', item);
        }
        if (removed.length > 0) await this.#emitChange();
        this.#syncMainView();
        if (this.#openState === 'open') this.#refreshListPreservingFocus();
    }

    /**
     * Программная установка выбора (спека §17).
     * @param {(string|number)[]} ids
     * @returns {Promise<void>}
     */
    async setValue(ids) {
        this.#assertAlive();
        const resolved = ids.map((ref) => this.#resolveId(ref));
        for (const r of resolved) {
            if (r === undefined) throw new Error(`Unknown id in setValue: ${String(r)}.`);
        }
        const { added, removed } = this.#state.setValue(/** @type {(string|number)[]} */ (resolved));
        for (const item of removed) await this.#emitter.emit('deselect', item);
        for (const item of added) await this.#emitter.emit('select', item);
        if (removed.length > 0 || added.length > 0) await this.#emitChange();
        this.#syncMainView();
        if (this.#openState === 'open') {
            this.#renderer.updateOptionStates(new Set(this.#state.getSelectedIds()));
        }
    }

    /**
     * Реактивное обновление конфигурации (спека §19–20).
     * @param {Partial<CustomSelectConfig>} patch
     * @returns {Promise<void>}
     */
    async updateConfig(patch) {
        this.#assertAlive();
        if (patch === null || typeof patch !== 'object') {
            throw new TypeError('updateConfig: expected object.');
        }
        const prev = { ...this.#cfg() };
        const next = this.#configManager.update(patch);

        if ('items' in patch) await this.setItems(next.items);
        if ('selectedIds' in patch) await this.setValue(/** @type {(string|number)[]} */ (next.selectedIds));

        if ('multiple' in patch && prev.multiple !== next.multiple) {
            const collapsed = this.#state.setMultiple(next.multiple);
            for (const item of collapsed) await this.#emitter.emit('deselect', item);
            if (collapsed.length > 0) await this.#emitChange();
        }

        const wasEnabled = prev.disabled === true;
        this.#renderer.setStateFlags(next);
        this.#renderer.applyPopoverConfig(next);
        if (next.disabled && !wasEnabled && (this.#openState === 'open' || this.#openState === 'opening')) {
            await this.close();
        }

        const geometryKeys = /** @type {const} */ (['lineHeight', 'maxLines', 'columns', 'columnGap', 'modalMaxHeight', 'modalOffset', 'modalWidth', 'mainWidth']);
        const geoChanged = geometryKeys.some((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
        if (geoChanged) {
            this.#applyGeometryVars();
            this.#syncMainView();
            this.#scheduleReposition();
        }

        const viewKeys = /** @type {const} */ (['searchable', 'searchMode', 'searchCaseSensitive', 'showSelectedItems', 'highlightSearchMatches', 'emptySearchText', 'emptyListText', 'placeholder', 'showClearAll', 'showSelectAll']);
        const viewChanged = viewKeys.some((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
        if (viewChanged) {
            this.#syncMainView();
            if (this.#openState === 'open') this.#refreshListPreservingFocus();
        }

        if (prev.animations !== next.animations) {
            this.#renderer.getPopover().dataset.cselAnim = next.animations ? 'true' : 'false';
        }
    }

    destroy() {
        if (this.#destroyed) throw new Error('CustomSelect instance has already been destroyed.');
        this.#destroyed = true;
        this.#deactivateListeners();
        if (this.#resizeObserver) {
            this.#resizeObserver.disconnect();
            this.#resizeObserver = null;
        }
        if (this.#repositionRafId) {
            cancelAnimationFrame(this.#repositionRafId);
            this.#repositionRafId = 0;
        }
        try {
            const popover = this.#renderer.getPopover();
            if (popover.matches(':popover-open')) popover.hidePopover();
        } catch {
            /* popover уже удалён браузером */
        }
        this.#renderer.disposeMain();
        this.#renderer.disposePopover();
        this.#openState = 'destroyed';
        this.#lastMatched = [];
        this.#activeId = null;
    }
}
```

Внимание к деталям реализации (обязательно исполнить):

1. В `#uiRemoveTag` вызов `#mutateAndSync(...)` передаёт `id` уже разрешённым; после мутации `getItem(id)` может быть актуален — item берётся ДО мутации: переставьте получение item выше `#mutateAndSync` и замкните его в emitFn (иначе при setItems-гонке возможен undefined). Финальная версия:

```js
    async #uiRemoveTag(idRef) {
        const c = this.#cfg();
        if (c.disabled || c.readonly) return;
        const id = this.#resolveId(idRef);
        if (id === undefined) return;
        const item = /** @type {CustomSelectItem} */ (this.#state.getItem(id));
        this.#mutateAndSync(() => this.#state.deselect(id), async () => {
            await this.#emitter.emit('deselect', item);
            await this.#emitChange();
        }, { keepOpen: true });
    }
```

2. `setValue`: `resolved` содержит `undefined` при неизвестном id — проверка внутри цикла бросает до мутации, но текст ошибки теряет исходный id; замените цикл на строгий предварительный резолв с понятным сообщением:

```js
        /** @type {(string|number)[]} */
        const resolved = [];
        for (const ref of ids) {
            const r = this.#resolveId(ref);
            if (r === undefined) throw new Error(`Unknown id in setValue: ${String(ref)}.`);
            resolved.push(r);
        }
        const { added, removed } = this.#state.setValue(resolved);
```

3. JSDoc-тип параметра `on/off` упрощается до `string` (алиасы типов через `typeof EVENT_ALIASES[keyof ...]` не работают в checkJs без шаблонов) — используйте `@param {string} event`.

- [ ] **Step 7: Гейты**

Run: `npm run typecheck && npm run build && npm run test:unit`
Expected: PASS. Исправить все ошибки checkJs (частые: implicit any в callback'ах — добавить JSDoc; `noUncheckedIndexedAccess` — проверки на undefined).

- [ ] **Step 8: Commit**

```bash
git add src/core/CustomSelect.js && git commit -m "feat: CustomSelect facade with lifecycle, search, keyboard, dynamic updates"
```

---

### Task 15: Демо-страница

**Files:**
- Create: `src/demo/main.js`, `src/demo/data.js`
- Modify: `index.html` (добавить контейнеры секций и стили демо)

**Interfaces:**
- Consumes: `CustomSelect` из `../core/CustomSelect.js` и CSS `../styles/index.css`.
- Produces: страница на `http://localhost:5173` со сценариями спеки §95 (single/multiple/search/layout/dynamic/interaction/accessibility/instances).

- [ ] **Step 1: src/demo/data.js**

```js
/** @returns {import('../types.js').CustomSelectItem[]} */
export function makeFruits() {
    return [
        { id: 'apple', type: 'text', content: 'Apple', group: 'Fruits' },
        { id: 'apricot', type: 'text', content: 'Apricot', group: 'Fruits' },
        { id: 'banana', type: 'text', content: 'Banana', group: 'Fruits' },
        { id: 'carrot', type: 'text', content: 'Carrot', group: 'Vegetables' },
        { id: 'potato', type: 'text', content: 'Potato', disabled: true, group: 'Vegetables' },
        { id: 'tomato', type: 'text', content: 'Tomato', group: 'Vegetables' },
        { id: 'red-car', type: 'text', content: 'Red Car', searchKeywords: ['vehicle', 'auto'] },
        { id: 'blue-bus', type: 'text', content: 'Blue Bus', searchKeywords: ['vehicle'] },
    ];
}

const PALETTE = ['e11d48', '6366f1', '059669', 'd97706', '7c3aed'];

/** @returns {import('../types.js').CustomSelectItem[]} */
export function makeImages() {
    return PALETTE.map((hex, i) => ({
        id: i + 1,
        type: 'image',
        content: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='12' fill='%23${hex}'/></svg>`,
        searchKeywords: [`color-${i + 1}`, hex],
        ariaLabel: `Palette ${i + 1}`,
    }));
}

/** @returns {import('../types.js').CustomSelectItem[]} */
export function makeMany(n = 100) {
    return Array.from({ length: n }, (_, i) => ({
        id: i,
        type: 'text',
        content: `Item ${String(i + 1).padStart(3, '0')}`,
        group: i % 2 === 0 ? 'Even' : 'Odd',
        disabled: i === 50,
    }));
}
```

- [ ] **Step 2: src/demo/main.js**

```js
import '../styles/index.css';
import CustomSelect from '../core/CustomSelect.js';
import { makeFruits, makeImages, makeMany } from './data.js';

const log = (name) => (/** @type {string} */ event, /** @type {unknown} */ payload) =>
    console.info(`[${name}] ${event}`, payload);

function section(title) {
    const h = document.createElement('h2');
    h.textContent = title;
    document.getElementById('app')?.append(h);
    const box = document.createElement('div');
    box.className = 'demo-row';
    document.getElementById('app')?.append(box);
    return box;
}

// Single text
{
    const box = section('Single / text');
    const host = document.createElement('div');
    box.append(host);
    new CustomSelect(host, { items: makeFruits(), placeholder: 'Фрукт...' }, {
        onSelect: (i) => log('single')( 'select', i),
        onChange: (xs) => log('single')('change', xs),
    });
}

// Single image
{
    const box = section('Single / image');
    const host = document.createElement('div');
    box.append(host);
    new CustomSelect(host, { items: makeImages(), searchable: true });
}

// Multiple with tags/maxLines/clear/selectAll
{
    const box = section('Multiple / tags / maxLines=2 / select-all');
    const host = document.createElement('div');
    host.style.width = '420px';
    box.append(host);
    const sel = new CustomSelect(host, {
        items: makeFruits(),
        multiple: true,
        maxLines: 2,
        showSelectAll: true,
        selectedIds: ['apple', 'banana'],
    });
    const btn = document.createElement('button');
    btn.textContent = 'setValue([carrot, tomato])';
    btn.addEventListener('click', () => void sel.setValue(['carrot', 'tomato']));
    box.append(btn);
}

// Search modes demo (fuzzy + highlight)
{
    const box = section('Search fuzzy + highlight');
    const host = document.createElement('div');
    box.append(host);
    new CustomSelect(host, {
        items: makeMany(60),
        searchMode: 'fuzzy',
        highlightSearchMatches: true,
    });
}

// Multi-column layout
{
    const box = section('Layout / columns=3 horizontal scroll');
    const host = document.createElement('div');
    box.append(host);
    new CustomSelect(host, { items: makeMany(80), columns: 3, modalMaxHeight: 240 });
}

// Dynamic config
{
    const box = section('Dynamic updateConfig');
    const host = document.createElement('div');
    box.append(host);
    const sel = new CustomSelect(host, { items: makeFruits() });
    let on = false;
    const btn = document.createElement('button');
    btn.textContent = 'toggle disabled/readonly/loading';
    btn.addEventListener('click', () => {
        on = !on;
        void sel.updateConfig(on ? { loading: true } : { loading: false });
    });
    box.append(btn);
}

// Three independent instances
{
    const box = section('Instances isolation x3');
    for (let i = 0; i < 3; i++) {
        const host = document.createElement('div');
        box.append(host);
        new CustomSelect(host, { items: makeFruits(), multiple: i % 2 === 1 });
    }
}
```

- [ ] **Step 3: index.html — стили демо**

В `<head>` добавить:

```html
<style>
    body { background: #09090b; color: #f4f4f5; font-family: system-ui, sans-serif; padding: 24px; }
    .demo-row { display: flex; gap: 12px; align-items: center; margin-bottom: 28px; max-width: 720px; }
    button { background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
</style>
```

- [ ] **Step 4: Ручная проверка**

Run: `npm run dev` → открыть http://localhost:5173, проверить открытие/выбор/поиск/колонки/динамику.
Expected: все секции работают без ошибок в консоли.

- [ ] **Step 5: Commit**

```bash
git add src/demo index.html && git commit -m "feat: demo page covering spec scenarios"
```

---

### Task 16: Публичные экспорты + d.ts

**Files:**
- Modify: `src/index.js`

**Interfaces:**
- Produces: публичная поверхность пакета — default export класса, именованные экспорты ошибко-устойчивых утилит не требуется по спеке §63 (только класс). d.ts генерируется vite-plugin-dts при build.

- [ ] **Step 1: src/index.js**

```js
import './styles/index.css';
export { default } from './core/CustomSelect.js';
export { VERSION } from './version.js';
```

Импорт CSS обязателен: иначе Vite lib-сборка не сгенерирует `dist/index.css` (`sideEffects` в package.json уже объявлен).

Создать `src/version.js`:

```js
export const VERSION = '0.1.0';
```

И поправить smoke-тест (`tests/unit/smoke.test.js`) — импорт остаётся тем же.

Также для типов потребителей экспортировать typedef'ы через отдельный файл не требуется: `.d.ts` собирается rollupTypes из JSDoc. Убедиться, что `CustomSelect.js` импортирует типы через `import()`-ссылки (уже сделано), иначе rollupTypes потеряет typedefs.

- [ ] **Step 2: Гейты**

Run: `npm run build && npm run typecheck && npm run test:unit && node --input-type=module -e "console.log(Object.keys(await import('./dist/index.js')))"`
Expected: build PASS; в dist есть `index.js`, `index.css`, `index.d.ts`; node-проверка печатает `['default','VERSION']`.

- [ ] **Step 3: Commit**

```bash
git add src/index.js src/version.js tests/unit/smoke.test.js && git commit -m "feat: public ESM entry with declarations"
```

---

### Task 17: Playwright — интеграционные тесты

**Files:**
- Create: `tests/integration/harness.html`, `tests/integration/custom-select.spec.js`

**Interfaces:**
- Consumes: dev-сервер (playwright webServer из Task 1); harness читает query-параметр `?case=` и создаёт соответствующий экземпляр.

- [ ] **Step 1: tests/integration/harness.html**

```html
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>harness</title>
    <style>body{background:#09090b;padding:40px}#host{width:400px}</style>
</head>
<body>
<div id="host"></div>
<script type="module">
    import CustomSelect from '/src/index.js';
    import '/src/styles/index.css';

    const params = new URLSearchParams(location.search);
    const kase = params.get('case') ?? 'basic';

    /** @returns {Array<any>} */
    const baseItems = [
        { id: 'a', type: 'text', content: 'Alpha' },
        { id: 'b', type: 'text', content: 'Beta' },
        { id: 'c', type: 'text', content: 'Gamma', disabled: true },
        { id: 'd', type: 'text', content: 'Delta', group: 'G' },
        { id: 'e', type: 'text', content: 'Epsilon', group: 'G' },
    ];

    /** @type {Record<string, any>} */
    const cases = {
        basic: { items: baseItems },
        single: { items: baseItems, selectedIds: ['a'] },
        multi: { items: baseItems, multiple: true, selectedIds: ['a'], showSelectAll: true, showClearAll: true, maxLines: 1 },
        search: { items: baseItems, highlightSearchMatches: true },
        columns: { items: Array.from({ length: 30 }, (_, i) => ({ id: i, type: 'text', content: `Opt ${i}` })), columns: 3, modalMaxHeight: 180 },
        readonly: { items: baseItems, readonly: true },
        loading: { items: baseItems, loading: true },
        disabled: { items: baseItems, disabled: true },
        events: { items: baseItems, multiple: true },
        overflowBottom: { items: baseItems },
    };

    if (kase === 'overflowBottom') {
        const spacer = document.createElement('div');
        spacer.style.height = 'calc(100vh - 120px)';
        document.body.prepend(spacer);
    }

    window.__select = new CustomSelect(document.getElementById('host'), cases[kase] ?? cases.basic, {
        onSelect: (item) => window.dispatchEvent(new CustomEvent('csel-select', { detail: item.id })),
        onDeselect: (item) => window.dispatchEvent(new CustomEvent('csel-deselect', { detail: item.id })),
        onChange: (items) => window.dispatchEvent(new CustomEvent('csel-change', { detail: items.map((i) => i.id) })),
        onOpen: () => window.dispatchEvent(new CustomEvent('csel-open')),
        onClose: () => window.dispatchEvent(new CustomEvent('csel-close')),
        onSearch: (q, matched) => window.dispatchEvent(new CustomEvent('csel-search', { detail: { q, n: matched.length } })),
        onClear: () => window.dispatchEvent(new CustomEvent('csel-clear')),
    });

    window.__api = window.__select;
</script>
</body>
</html>
```

- [ ] **Step 2: tests/integration/custom-select.spec.js**

```js
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
            document.getElementById('host').replaceWith(wrap);
            wrap.append(window.__select ? document.querySelector('.csel-root') : null);
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
        await expect(page.locator('.csel-empty')).toHaveText('Ничего не найдено');
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
        await root(page).click();
        await expect(popover(page)).toBeVisible();
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
```

Замечание: тесты используют `window.__api/__select/__sel2` из harness. Для TypeScript-комфорта в spec это `any` — Playwright-тесты не проходят checkJs проекта (tsconfig include только src).

- [ ] **Step 3: Прогон**

Run: `npm run test:e2e`
Expected: все тесты зелёные в chromium/firefox/webkit. Отладка падений — только по фактам скриншотов/трейсов, без ослабления ассертов.

- [ ] **Step 4: Commit**

```bash
git add tests/integration && git commit -m "test: playwright integration suite"
```

---

### Task 17b: Proximity e2e (отдельный спек)

**Files:**
- Create: `tests/integration/proximity.spec.js`

- [ ] **Step 1: Тест arming-правила реальным указателем**

```js
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
```

- [ ] **Step 2: Run → PASS, Commit**

```bash
npm run test:e2e
git add tests/integration/proximity.spec.js && git commit -m "test: proximity arming rule end-to-end"
```

---

### Task 18: Финальная верификация DoD

**Files:** без новых файлов.

- [ ] **Step 1: Полный гейт**

Run: `npm run typecheck && npm run test:unit && npm run build && npm run test:e2e`
Expected: всё PASS без warnings.

- [ ] **Step 2: Проверка артефактов**

Run: `ls dist` и проверка содержимого `dist/index.d.ts` (экспорт класса).
Expected: `index.js`, `index.css`, `index.d.ts`.

- [ ] **Step 3: Чек-лист спеки §96 пройтись глазами по коду**

Особо проверить руками/тестами: duplicate IDs отклоняются; setValue строгий; setItems сохраняет selection; Escape/focus restore; updateConfig на открытом popover сохраняет query/active/scroll; prefers-reduced-motion отключает анимацию (CSS media); отсутствие innerHTML над пользовательскими данными (grep по src).

Run: `grep -rn "innerHTML" src/ || echo OK`
Expected: единственное допустимое использование отсутствует вовсе (chevron строится createElementNS).

- [ ] **Step 4: Финальный коммит**

```bash
git add -A && git commit -m "chore: final DoD verification" --allow-empty
```
