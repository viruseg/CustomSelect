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
    const tokens =
        mode === 'exact'
            ? [normalize(query.trim(), caseSensitive)].filter(Boolean)
            : tokenize(query).map((tok) => normalize(tok, caseSensitive));
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
            buffer = /** @type {string} */ (text[i]);
            current = /** @type {boolean} */ (marks[i]);
        }
    }
    if (buffer) segments.push({ text: buffer, match: current });
    return segments;
}
