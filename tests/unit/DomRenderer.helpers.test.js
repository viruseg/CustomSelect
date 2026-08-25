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
