import { describe, it, expect } from 'vitest';
import { normalize, tokenize, isSubsequence, search, highlightSegments } from '../../src/core/SearchEngine.js';

const t = (id, content, keywords) => ({ id, type: 'text', content, ...(keywords ? { searchKeywords: keywords } : {}) });
const img = (id, src, keywords) => ({ id, type: 'image', content: src, searchKeywords: keywords });

describe('normalize/tokenize/isSubsequence', () => {
    it('NFKC + lowercase by default', () => {
        expect(normalize('Ａｐｐｌｅ', false)).toBe(normalize('Apple', false));
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
        expect(search(catalog, 'car', m).map((i) => i.id)).toEqual([4]);
        expect(search(catalog, 'ed', m)).toEqual([]);
    });

    it('exact requires full equality after normalization', () => {
        const m = { searchMode: 'exact' };
        expect(search(catalog, 'red car', m).map((i) => i.id)).toEqual([1]);
        expect(search(catalog, 'red', m)).toEqual([]);
    });

    it('fuzzy allows ordered gaps', () => {
        expect(search(catalog, 'cr', { searchMode: 'fuzzy' }).map((i) => i.id)).toEqual([1, 4]);
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
        expect(search([t(1, 'Ａｐｐｌｅ')], 'apple')).toHaveLength(1);
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
