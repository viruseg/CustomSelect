import { describe, it, expect } from 'vitest';
import ConfigManager, { DEFAULT_CONFIG, validateItems } from '../../src/core/ConfigManager.js';

describe('DEFAULT_CONFIG', () => {
    it('matches spec defaults', () => {
        expect(DEFAULT_CONFIG.multiple).toBe(false);
        expect(DEFAULT_CONFIG.placeholder).toBe('Select a value...');
        expect(DEFAULT_CONFIG.emptySearchText).toBe('No matches found');
        expect(DEFAULT_CONFIG.emptyListText).toBe('No items available');
        expect(DEFAULT_CONFIG.lineHeight).toBe(36);
        expect(DEFAULT_CONFIG.modalMaxHeight).toBe(320);
        expect(DEFAULT_CONFIG.modalOffset).toBe(4);
        expect(DEFAULT_CONFIG.columns).toBe(1);
        expect(DEFAULT_CONFIG.columnGap).toBe(8);
        expect(DEFAULT_CONFIG.searchMode).toBe('contains');
        expect(DEFAULT_CONFIG.cursorDistanceThreshold).toBe(150);
        expect(DEFAULT_CONFIG.mainWidth).toBe(150);
        expect(DEFAULT_CONFIG.animations).toBe(true);
        expect(DEFAULT_CONFIG.showSelectedItems).toBe(true);
        expect(DEFAULT_CONFIG.highlightSearchMatches).toBe(false);
        expect(DEFAULT_CONFIG.className).toBe('');
        expect(DEFAULT_CONFIG.attributes).toEqual({});
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
        expect(cm.config.mainWidth).toBe(150);
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

    it.each([
        [{ className: 123 }, /className/],
        [{ className: null }, /className/],
        [{ attributes: 'str' }, /attributes/],
        [{ attributes: [] }, /attributes/],
        [{ attributes: null }, /attributes/],
        [{ attributes: { x: 123 } }, /attributes/],
    ])('rejects invalid %j', (patch, rx) => {
        const cm = new ConfigManager({ items: [] });
        expect(() => cm.update(patch)).toThrow(rx);
        expect(() => new ConfigManager({ items: [], ...patch })).toThrow(rx);
    });

    it('accepts valid className and attributes', () => {
        const cm = new ConfigManager({ items: [], className: 'my-class', attributes: { 'data-id': 'x', role: 'combobox' } });
        expect(cm.config.className).toBe('my-class');
        expect(cm.config.attributes).toEqual({ 'data-id': 'x', role: 'combobox' });
    });

    it('ignores unknown properties', () => {
        const cm = new ConfigManager({ items: [] });
        cm.update({ nonsense: 42 });
        expect(cm.config.nonsense).toBeUndefined();
    });
});
