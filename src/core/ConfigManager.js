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
        placeholder: 'Select a value...',
        maxLines: 1,
        lineHeight: 36,
        mainWidth: 150,
        modalWidth: 'auto',
        modalMaxHeight: 320,
        modalOffset: 4,
        columns: 1,
        columnGap: 8,
        searchable: true,
        searchMode: 'contains',
        searchCaseSensitive: false,
        emptySearchText: 'No matches found',
        emptyListText: 'No items available',
        showClearAll: true,
        showSelectAll: false,
        disabled: false,
        readonly: false,
        loading: false,
        animations: true,
        cursorDistanceThreshold: 150,
        showSelectedItems: true,
        highlightSearchMatches: false,
        className: '',
        attributes: {},
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
        if (rec[field] !== undefined) checkNumeric(field, rec[field], NUMERIC_RULES[/** @type {keyof typeof NUMERIC_RULES} */ (field)]);
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
    if (rec['className'] !== undefined && typeof rec['className'] !== 'string') {
        throw new TypeError('Invalid CustomSelectConfig.className: expected string.');
    }
    if (rec['attributes'] !== undefined) {
        if (typeof rec['attributes'] !== 'object' || rec['attributes'] === null || Array.isArray(rec['attributes'])) {
            throw new TypeError('Invalid CustomSelectConfig.attributes: expected object.');
        }
        for (const [key, val] of Object.entries(/** @type {Record<string, unknown>} */ (rec['attributes']))) {
            if (typeof val !== 'string') {
                throw new TypeError(`Invalid CustomSelectConfig.attributes["${key}"]: expected string value.`);
            }
        }
    }

    for (const key of Object.keys(rec)) {
        if (key === 'items' || key === 'selectedIds') continue;
        if (key in DEFAULT_CONFIG) {
            (/** @type {Record<string, unknown>} */ (/** @type {unknown} */ (next)))[key] = /** @type {any} */ (rec[key]);
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
