import ConfigManager, { validateItems } from './ConfigManager.js';
import StateManager from './StateManager.js';
import EventEmitter from './EventEmitter.js';
import DomRenderer from './DomRenderer.js';
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
    #keyboardNav = /** @type {KeyboardNav} */ (/** @type {unknown} */ (null));
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
    /** Постоянная проводка (main/popover), снимается только в destroy. @type {Array<()=>void>} */
    #disposables = [];
    /** Скоуп активной фазы (открыт): document/window/proximity, снимается в deactivate и destroy. @type {Array<()=>void>} */
    #openDisposables = [];
    /** @type {CustomSelectItem[]} */
    #lastMatched = [];

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
            const rec = /** @type {Record<string, Function|undefined>} */ (/** @type {unknown} */ (events));
            for (const [alias, eventName] of Object.entries(EVENT_ALIASES)) {
                const handler = rec[alias];
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

    // ── Приватные помощники ─────────────────────────────────────────────

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
        rootStyle.setProperty('--csel-main-width', typeof c.mainWidth === 'number' ? `${c.mainWidth}px` : (c.mainWidth ?? '100%'));
        rootStyle.setProperty('--csel-max-lines', String(c.maxLines));
        // multiple: высоту резервирует CSS-правило .csel-root--multiple .csel-value-area
        // (формула с учётом межстрочного ритма) — inline min-height здесь не нужен
        rootStyle.minHeight = '';
        const pop = this.#renderer.getPopover();
        pop.style.setProperty('--csel-line-height', `${c.lineHeight}px`);
        pop.style.setProperty('--csel-columns', String(c.columns));
        pop.style.setProperty('--csel-column-gap', `${c.columnGap}px`);
        pop.style.setProperty('--csel-modal-max-height', `${c.modalMaxHeight}px`);
        pop.style.setProperty('--csel-modal-width',
            c.modalWidth === 'auto' ? 'auto' : typeof c.modalWidth === 'number' ? `${c.modalWidth}px` : (c.modalWidth ?? 'auto'));
        pop.dataset.cselAnim = c.animations ? 'true' : 'false';
        this.#renderer.setMultiColumn((c.columns ?? 1) > 1);
    }

    /** Перерисовывает значение/теги основного модуля из состояния. */
    #syncMainView() {
        const c = this.#cfg();
        const selected = this.#state.getSelectedItems();
        if (c.multiple) {
            this.#renderer.renderValue(null, c);
            this.#renderer.renderTags(selected, c);
            // Плейсхолдер в multiple показывается только при пустом выборе,
            // иначе он отнимает ширину строки у тегов.
            this.#renderer.setPlaceholderVisible(selected.length === 0);
            this.#recalcTags();
        } else {
            this.#renderer.renderTags([], c);
            this.#renderer.renderValue(selected[0] ?? null, c);
            this.#renderer.setMoreVisible(false);
        }
        this.#renderer.setClearVisible(c.showClearAll === true && selected.length > 0);
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
            // Carry-forward A: в exact-режиме поиск работает полным запросом как одним токеном —
            // подсветка должна получать тот же единственный токен, иначе многословные
            // точные совпадения никогда не выделяются.
            const exactToken = c.searchMode === 'exact' && this.#query.trim() !== '' ? [this.#query] : undefined;
            this.#renderer.clearStatus();
            this.#renderer.renderList(matched, {
                query: this.#query,
                tokens: exactToken,
                activeId: this.#activeId,
                multiple: c.multiple === true,
                selectedIds: new Set(this.#state.getSelectedIds()),
                highlight: c.highlightSearchMatches === true,
                searchMode: c.searchMode,
                searchCaseSensitive: c.searchCaseSensitive === true,
                searchable: c.searchable === true,
            });
            this.#updateNavRows();
        }
    }

    /** Число строк сетки по фактической высоте списка (спека §43). */
    #updateNavRows() {
        const c = this.#cfg();
        const lineHeight = c.lineHeight ?? 36;
        if ((c.columns ?? 1) <= 1) {
            this.#renderer.setNavRowCount(null);
            this.#renderer.setGridRows(null);
            return;
        }
        // Пока popover display:none (первое открытие до showPopover), clientHeight=0 —
        // строки сетки выставим после фактического показа (см. #openInternal).
        const listbox = this.#renderer.getNavModel().options[0]?.element?.parentElement;
        const h = listbox?.clientHeight ?? 0;
        if (!h) return;
        const rows = Math.max(1, Math.floor(h / lineHeight));
        this.#renderer.setNavRowCount(rows);
        this.#renderer.setGridRows(rows);
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
                const removeBtn = /** @type {HTMLElement} */ (t.closest('.csel-tag-remove'));
                void this.#uiRemoveTag(this.#parseId(/** @type {string} */ (removeBtn.dataset.id)));
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
            // Значение/тег: семантика спеки §22 — открыть (без закрытия).
            // Плейсхолдер и пустое место: переключить открытие/закрытие.
            const onValue = t.closest('.csel-tag') || t.closest('.csel-value-text');
            if (onValue) void this.open();
            else void this.toggle();
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

        els.root.addEventListener('click', /** @type {EventListener} */ (onClick));
        els.root.addEventListener('keydown', /** @type {EventListener} */ (onKeyDown));
        this.#disposables.push(() => {
            els.root.removeEventListener('click', /** @type {EventListener} */ (onClick));
            els.root.removeEventListener('keydown', /** @type {EventListener} */ (onKeyDown));
        });
    }

    #wirePopoverEvents() {
        const refs = this.#renderer.ensurePopover(this.#cfg());

        const onSearchInput = () => void this.#onQueryChanged(refs.searchInput.value);

        const onSearchClear = () => {
            refs.searchInput.value = '';
            void this.#onQueryChanged('');
        };

        const onSelectAllClick = () => void this.selectAll();

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
        refs.popover.addEventListener('keydown', /** @type {EventListener} */ (onPopoverKeyDown));

        /**
         * Колесо над многоколоночным списком прокручивает колонки.
         * overflow-y:hidden лишает браузер вертикального канала, трансляция
         * deltaY даёт лишь микроподвижки, которые mandatory-snap откатывает —
         * поэтому транслируем явно в scrollLeft (программный скролл снапится
         * вперёд, к ближайшей колонке).
         * @param {WheelEvent} e
         */
        const onListWheel = (e) => {
            const lb = refs.listbox;
            if (!lb.classList.contains('csel-listbox--grid')) return;
            const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            if (!d || lb.scrollWidth <= lb.clientWidth + 1) return;
            e.preventDefault();
            lb.scrollLeft += d;
        };
        refs.listbox.addEventListener('wheel', onListWheel, { passive: false });

        // Перманентный сторож внешнего light-dismiss (спека §11): ancestor display:none,
        // сторонний hidePopover и т.п. не проходят через close() — сверяемся через обычный
        // путь закрытия, иначе #openState навсегда остаётся 'open' и очередь переходов
        // отравляется зависшим #awaitToggle.
        /** @param {Event} e */
        const onExternalClose = (e) => {
            const state = /** @type {{newState?: string}} */ (e).newState;
            if (this.#destroyed || this.#openState === 'destroyed') return;
            if (state === 'closed' && (this.#openState === 'open' || this.#openState === 'opening')) {
                void this.close();
            }
        };
        refs.popover.addEventListener('toggle', onExternalClose);

        this.#disposables.push(() => {
            refs.searchInput.removeEventListener('input', onSearchInput);
            refs.searchClear.removeEventListener('click', onSearchClear);
            refs.selectAllButton.removeEventListener('click', onSelectAllClick);
            refs.clearAllButton.removeEventListener('click', onClearAllClick);
            refs.listbox.removeEventListener('click', onListClick);
            refs.listbox.removeEventListener('wheel', onListWheel);
            refs.popover.removeEventListener('keydown', /** @type {EventListener} */ (onPopoverKeyDown));
            refs.popover.removeEventListener('toggle', onExternalClose);
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

    // ── Выбор/снятие/batch/query ────────────────────────────────────────

    /**
     * Клик/Enter по тегу-remove (item фиксируется ДО мутации).
     * @param {string|number} idRef
     */
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
        // Carry-forward B (инвариант №13): после перестройки активная опция должна
        // существовать среди включённых; иначе корректируем до первой доступной.
        if (this.#activeId !== null) {
            const stillThere = this.#renderer.getNavModel().options.some((o) => o.id === this.#activeId && o.disabled !== true);
            if (!stillThere) this.#activeId = this.#firstEnabledNavId();
        }
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
        const searchClear = /** @type {HTMLElement|null} */ (document.querySelector(`#${this.#instanceId}-popover .csel-search-clear`));
        if (searchClear) searchClear.hidden = value.trim() === '';
        this.#refreshList();
        // Коррекция active: активная должна быть существующей enabled опцией (инвариант №13)
        if (this.#activeId !== null) {
            const stillThere = refs.getNavModel().options.some((o) => o.id === this.#activeId && o.disabled !== true);
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

    // ── Lifecycle open/close/toggle, позиционирование, proximity ────────

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
        // Toggle уже мог отработать до подписки — тогда разрешаемся немедленно по факту.
        if (popover.matches(':popover-open') === (expected === 'open')) return Promise.resolve();
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
        // Исключение после 'opening' (например, showPopover() на detached-цели) не должно
        // оставлять вечное 'opening' и отравлять очередь переходов.
        try {
            this.#refreshList();
            this.#applyGeometryVars();
            const popover = this.#renderer.getPopover();
            this.#repositionNow();
            popover.showPopover();
            await this.#awaitToggle(popover, 'open');
            if (this.#destroyed) return;
            this.#openState = 'open';
            this.#activateListeners();
            // Реальная высота listbox известна только после показа — теперь можно
            // расставить строки сетки (до этого clientHeight был 0 в display:none).
            this.#updateNavRows();
        } catch (err) {
            if (this.#openState === 'opening') {
                this.#openState = 'closed';
                this.#deactivateListeners();
            }
            throw err;
        }
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
        // Исключение после 'closing' не должно оставлять вечное 'closing': доводим до
        // closed-состояния (false-путь matches(':popover-open')) и пробрасываем дальше.
        try {
            this.#deactivateListeners();
            const popover = this.#renderer.getPopover();
            if (popover.matches(':popover-open')) popover.hidePopover();
            await this.#awaitToggle(popover, 'closed');
            this.#renderer.elements.toggleButton?.focus();
            this.#query = '';
            this.#renderer.setQueryInputValue('');
            this.#activeId = null;
            this.#renderer.setActiveOption(null, { searchable: false });
        } catch (err) {
            this.#openState = 'closed';
            this.#deactivateListeners();
            throw err;
        }
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

    /** @param {boolean} expanded */
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
            threshold: c.cursorDistanceThreshold ?? 150,
            getRects: () => ({
                main: toRect(rootEl.getBoundingClientRect()),
                popover: toRect(popoverEl.getBoundingClientRect()),
            }),
            onThresholdExceeded: () => void this.close(),
        });
        this.#proximity.attach();

        this.#openDisposables.push(
            () => document.removeEventListener('pointerdown', onDocPointerDown, true),
            () => window.removeEventListener('resize', onWinReposition),
            () => window.removeEventListener('scroll', onWinReposition, { capture: true }),
            () => this.#proximity?.detach(),
        );
    }

    #deactivateListeners() {
        for (const off of this.#openDisposables.splice(0)) off();
        this.#proximity = null;
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

        // Intrinsic-размер: до showPopover popover display:none → offset* = 0.
        // Замеряем в офф-скрин measuring-состоянии (см. .csel-popover--measure).
        const needsMeasure = !popover.matches(':popover-open');
        if (needsMeasure) popover.classList.add('csel-popover--measure');
        const intrinsicW = popover.offsetWidth || 240;
        const intrinsicH = popover.offsetHeight || 120;
        if (needsMeasure) {
            popover.classList.remove('csel-popover--measure');
            void popover.offsetWidth; // сброс layout-кэша после снятия класса
        }

        const placement = calculatePlacement(
            triggerRect,
            { left: 0, top: 0, width: intrinsicW, height: intrinsicH },
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
                { left: 0, top: 0, width: triggerRect.width, height: intrinsicH },
                { width: window.innerWidth, height: window.innerHeight },
                { offset: c.modalOffset, maxHeight: c.modalMaxHeight },
            );
            popover.style.width = `${Math.round(widened.width)}px`;
        }
        popover.style.setProperty('--csel-trigger-min-width', `${Math.round(triggerRect.width)}px`);
        this.#updateNavRows();
    }

    // ── maxLines, публичный sync/dynamic API, destroy ───────────────────

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
            const limitTop = (c.lineHeight ?? 36) * (c.maxLines ?? 1);
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

    /** @param {string} event @param {Function} handler */
    on(event, handler) {
        this.#assertAlive();
        this.#emitter.on(event, handler);
    }

    /** @param {string} event @param {Function} handler */
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
        /** @type {(string|number)[]} */
        const resolved = [];
        for (const ref of ids) {
            const r = this.#resolveId(ref);
            if (r === undefined) throw new Error(`Unknown id in setValue: ${String(ref)}.`);
            resolved.push(r);
        }
        const { added, removed } = this.#state.setValue(resolved);
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
        // Атомарность: валидируем items/selectedIds ДО коммита скаляров через
        // ConfigManager, иначе при броске из setItems/setValue конфиг и state
        // разошлись бы (частично применённый patch).
        if ('items' in patch) validateItems(patch.items);
        if ('selectedIds' in patch) {
            const ids = /** @type {(string|number)[]} */ (patch.selectedIds);
            if (!Array.isArray(ids)) throw new TypeError('selectedIds: expected array.');
            const effMultiple = 'multiple' in patch ? patch.multiple === true : prev.multiple;
            if (!effMultiple && ids.length > 1) {
                throw new TypeError('Multiple selected ids provided in single mode.');
            }
            for (const ref of ids) {
                const r = this.#resolveId(ref);
                if (r === undefined) throw new Error(`Unknown id in setValue: ${String(ref)}.`);
            }
        }
        const next = this.#configManager.update(patch);

        // Спека §19–20: берём СЫРЫЕ значения из patch — ConfigManager.mergeValidated
        // пропускает keys items/selectedIds, поэтому next.* содержал бы устаревшие значения.
        // Валидация уже выполнена выше (dry-run), здесь пайплайны применяют state-изменения.
        if ('items' in patch) await this.setItems(/** @type {CustomSelectItem[]} */ (patch.items));
        if ('selectedIds' in patch) await this.setValue(/** @type {(string|number)[]} */ (patch.selectedIds));

        if ('multiple' in patch && prev.multiple !== next.multiple) {
            const collapsed = this.#state.setMultiple(next.multiple === true);
            for (const item of collapsed) await this.#emitter.emit('deselect', item);
            if (collapsed.length > 0) await this.#emitChange();
            this.#syncMainView();
        }

        const wasDisabled = prev.disabled === true;
        this.#renderer.setStateFlags(next);
        this.#renderer.applyPopoverConfig(next);
        if (next.disabled && !wasDisabled && (this.#openState === 'open' || this.#openState === 'opening')) {
            await this.close();
        }

        const geometryKeys = /** @type {const} */ (['lineHeight', 'maxLines', 'columns', 'columnGap', 'modalMaxHeight', 'modalOffset', 'modalWidth', 'mainWidth']);
        const geoChanged = geometryKeys.some((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
        if (geoChanged) {
            this.#applyGeometryVars();
            this.#syncMainView();
            this.#scheduleReposition();
        }

        const viewKeys = /** @type {const} */ (['searchable', 'searchMode', 'searchCaseSensitive', 'showSelectedItems', 'highlightSearchMatches', 'emptySearchText', 'emptyListText', 'placeholder', 'showClearAll', 'showSelectAll', 'loading']);
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
        for (const off of this.#disposables.splice(0)) off();
        this.#renderer.disposeMain();
        this.#renderer.disposePopover();
        this.#openState = 'destroyed';
        this.#lastMatched = [];
        this.#activeId = null;
    }
}

export { CustomSelect };
