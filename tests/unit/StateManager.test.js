import { describe, it, expect } from 'vitest';
import StateManager from '../../src/core/StateManager.js';

const text = (id, extra = {}) => ({ id, type: 'text', content: `c${String(id)}`, ...extra });
const items = () => [text(1), text(2), text(3, { disabled: true }), text('1'), text('g', { group: 'G' })];

describe('selection basics', () => {
    it('select/deselect/toggle', () => {
        const sm = new StateManager({ items: items(), multiple: true });
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
