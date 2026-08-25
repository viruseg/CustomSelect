/**
 * @typedef {import('../types.js').CustomSelectItem} CustomSelectItem
 * @typedef {import('../types.js').CustomSelectConfig} CustomSelectConfig
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

        const moreButton = document.createElement('button');
        moreButton.type = 'button';
        moreButton.className = 'csel-more';
        moreButton.textContent = '...';
        moreButton.tabIndex = -1;
        moreButton.hidden = true;

        valueArea.append(valueText, tagsContainer, moreButton);

        const placeholder = document.createElement('span');
        placeholder.className = 'csel-placeholder';
        placeholder.textContent = config.placeholder ?? '';

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
        this.#els = /** @type {MainRefs} */ ({});
        this.#tagRemoveButtons.clear();
    }
}
