import { describe, it, expect, vi } from 'vitest';
import KeyboardNav from '../../src/core/KeyboardNav.js';

function setup(options, rowCount = null, activeId = null) {
    const model = { options, rowCount, activeId };
    const setActive = vi.fn((id) => { model.activeId = id; });
    const selectIntent = vi.fn();
    const closeReq = vi.fn();
    const nav = new KeyboardNav({
        getModel: () => model,
        setActiveId: setActive,
        onSelectIntent: selectIntent,
        onRequestClose: closeReq,
    });
    return { nav, model, setActive, selectIntent, closeReq };
}

const opt = (id, disabled = false) => ({ id, disabled, element: { scrollIntoView: vi.fn() } });
const key = (k) => /** @type {any} */ ({ key: k, preventDefault: vi.fn() });

describe('single column', () => {
    const opts = () => [opt('a'), opt('b'), opt('c', true), opt('d')];

    it('ArrowDown skips disabled without wrap', () => {
        const { nav, model, setActive } = setup(opts(), null, 'a');
        nav.handleKeyDown(key('ArrowDown'));
        expect(setActive).toHaveBeenLastCalledWith('b');
        model.activeId = 'b';
        nav.handleKeyDown(key('ArrowDown'));
        expect(setActive).toHaveBeenLastCalledWith('d');
        model.activeId = 'd';
        nav.handleKeyDown(key('ArrowDown'));
        expect(setActive).toHaveBeenCalledTimes(2);
    });

    it('Left/Right are no-op in single column', () => {
        const { nav, setActive } = setup(opts(), null, 'a');
        nav.handleKeyDown(key('ArrowRight'));
        nav.handleKeyDown(key('ArrowLeft'));
        expect(setActive).not.toHaveBeenCalled();
    });

    it('Home/End pick first/last enabled', () => {
        const { nav, setActive } = setup(opts(), null, null);
        nav.handleKeyDown(key('Home'));
        expect(setActive).toHaveBeenLastCalledWith('a');
        nav.handleKeyDown(key('End'));
        expect(setActive).toHaveBeenLastCalledWith('d');
    });

    it('ArrowUp clamps at top', () => {
        const { nav, setActive } = setup(opts(), null, 'a');
        nav.handleKeyDown(key('ArrowUp'));
        expect(setActive).not.toHaveBeenCalled();
    });
});

describe('grid navigation (rowCount=2)', () => {
    const opts = () => [opt(1), opt(2), opt(3), opt(4), opt(5)];

    it('Up/Down move by row count with clamp', () => {
        const { nav, setActive } = setup(opts(), 2, 5);
        nav.handleKeyDown(key('ArrowDown'));
        expect(setActive).not.toHaveBeenCalled();
        nav.handleKeyDown(key('ArrowUp'));
        expect(setActive).toHaveBeenLastCalledWith(3);
        nav.handleKeyDown(key('ArrowUp'));
        expect(setActive).toHaveBeenLastCalledWith(1);
        nav.handleKeyDown(key('ArrowUp'));
        expect(setActive).toHaveBeenCalledTimes(2);
    });

    it('Left/Right move by one with clamp', () => {
        const { nav, setActive } = setup(opts(), 2, 1);
        nav.handleKeyDown(key('ArrowLeft'));
        expect(setActive).not.toHaveBeenCalled();
        nav.handleKeyDown(key('ArrowRight'));
        expect(setActive).toHaveBeenLastCalledWith(2);
    });
});

describe('activation and escape', () => {
    it('Enter/Space fire intent only on enabled option', () => {
        const { nav, selectIntent } = setup([opt('a'), opt('b', true)], null, 'b');
        nav.handleKeyDown(key('Enter'));
        nav.handleKeyDown(key(' '));
        expect(selectIntent).not.toHaveBeenCalled();
    });

    it('Enter on enabled fires intent with its id', () => {
        const { nav, selectIntent } = setup([opt('a')], null, 'a');
        nav.handleKeyDown(key('Enter'));
        expect(selectIntent).toHaveBeenCalledWith('a');
    });

    it('Escape requests close even with empty list', () => {
        const { nav, closeReq } = setup([], null, null);
        nav.handleKeyDown(key('Escape'));
        expect(closeReq).toHaveBeenCalledTimes(1);
    });
});
