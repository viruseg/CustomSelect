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
    checkAll(candidates) {
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

    uncheckAll() {
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
