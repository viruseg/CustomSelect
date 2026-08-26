import { tokenize, highlightSegments } from './SearchEngine.js';

/**
 * @typedef {import('../types.js').CustomSelectItem} CustomSelectItem
 * @typedef {import('../types.js').CustomSelectConfig} CustomSelectConfig
 * @typedef {import('../types.js').SearchMode} SearchMode
 */

/**
 * Локальная модель опции для клавиатурной навигации.
 * @typedef {{id: string|number, disabled: boolean, element: HTMLElement}} RendererNavOption
 * @typedef {{options: RendererNavOption[], rowCount: number|null, activeId: string|number|null}} RendererNavModel
 */

/**
 * Ссылки на элементы основного компонента.
 * @typedef {Object} MainRefs
 * @property {HTMLDivElement} root
 * @property {HTMLSpanElement} valueText
 * @property {HTMLDivElement} tagsContainer
 * @property {HTMLButtonElement} moreButton
 * @property {HTMLSpanElement} placeholder
 * @property {HTMLButtonElement} clearButton
 * @property {HTMLButtonElement} toggleButton
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
    /** @type {MainRefs} */
    #els = /** @type {MainRefs} */ ({});
    /** @type {Set<HTMLButtonElement>} */
    #tagRemoveButtons = new Set();
    /** @type {{popover: HTMLElement, searchHeader: HTMLElement, searchInput: HTMLInputElement, searchClear: HTMLButtonElement,
     *          selectAllButton: HTMLButtonElement, clearAllButton: HTMLButtonElement,
     *          listbox: HTMLElement, statusBox: HTMLElement} | null} */
    #popoverRefs = null;
    /** @type {RendererNavOption[]} */
    #navOptions = [];
    /** @type {number|null} */
    #navRowCount = null;
    /** @type {string|number|null} */
    #activeItemId = null;

    /** @param {{instanceId: string}} p */
    constructor({ instanceId }) {
        this.#instanceId = instanceId;
    }

    /** @returns {MainRefs} */
    get elements() {
        return this.#els;
    }

    /**
     * @param {HTMLElement} target
     * @param {CustomSelectConfig} config
     * @returns {MainRefs}
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

        const placeholder = document.createElement('span');
        placeholder.className = 'csel-placeholder';
        placeholder.textContent = config.placeholder ?? '';

        const moreButton = document.createElement('button');
        moreButton.type = 'button';
        moreButton.className = 'csel-more';
        moreButton.textContent = '...';
        moreButton.tabIndex = -1;
        moreButton.hidden = true;

        // Плейсхолдер живёт внутри value-area первым ребёнком: иначе valueArea с flex:1
        // выталкивает его к правому краю триггера.
        valueArea.append(placeholder, valueText, tagsContainer, moreButton);

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

        root.append(valueArea, clearButton, toggleButton);
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
            placeholder.textContent = config.placeholder ?? '';
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
    setPlaceholderVisible(visible) {
        this.#els.placeholder.hidden = !visible;
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
        root.classList.toggle('csel-root--multiple', config.multiple === true);
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
        this.#els = /** @type {MainRefs} */ ({});
        this.#tagRemoveButtons.clear();
    }

    /**
     * Создаёт popover-контейнер однократно и монтирует его в document.body.
     * @param {CustomSelectConfig} config
     * @returns {{popover: HTMLElement, searchHeader: HTMLElement, searchInput: HTMLInputElement, searchClear: HTMLButtonElement, selectAllButton: HTMLButtonElement, clearAllButton: HTMLButtonElement, listbox: HTMLElement, statusBox: HTMLElement}}
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
     * @param {string[]} [ctx.tokens] готовые токены подсветки; по умолчанию tokenize(ctx.query)
     * @param {boolean} [ctx.searchable]
     * @param {SearchMode|undefined} ctx.searchMode
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
        const tokens = Array.isArray(ctx.tokens) ? ctx.tokens : tokenize(ctx.query);
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

    /** @returns {RendererNavModel} */
    getNavModel() {
        return { options: [...this.#navOptions], rowCount: this.#navRowCount, activeId: this.#activeItemId };
    }

    /** @param {number|null} rows */
    setNavRowCount(rows) {
        this.#navRowCount = rows;
    }

    /**
     * Переключает listbox между вертикальным списком (single) и сеткой (multi).
     * @param {boolean} isMulti
     */
    setMultiColumn(isMulti) {
        this.#popoverRefs?.listbox.classList.toggle('csel-listbox--grid', isMulti === true);
    }

    /**
     * Явное число строк сетки — без него grid-auto-flow:column не переносит элементы вниз.
     * @param {number|null} rows
     */
    setGridRows(rows) {
        const lb = this.#popoverRefs?.listbox;
        if (!lb) return;
        lb.style.gridTemplateRows = rows ? `repeat(${rows}, var(--csel-line-height))` : '';
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
            div.textContent = text ?? '';
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
}
