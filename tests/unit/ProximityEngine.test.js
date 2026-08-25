import { describe, it, expect, vi } from 'vitest';
import ProximityEngine, { pointDistanceToRect } from '../../src/core/ProximityEngine.js';

const rect = (left, top, width, height) => ({ left, top, width, height });

describe('pointDistanceToRect', () => {
    const r = rect(10, 10, 100, 50);
    it('inside → 0', () => expect(pointDistanceToRect(50, 30, r)).toBe(0));
    it('on edge → 0', () => expect(pointDistanceToRect(110, 30, r)).toBe(0));
    it('right side → dx', () => expect(pointDistanceToRect(120, 30, r)).toBe(10));
    it('corner → euclidean', () =>
        expect(pointDistanceToRect(120, 70, r)).toBeCloseTo(Math.sqrt(200)));
    it('above → dy', () => expect(pointDistanceToRect(50, 0, r)).toBe(10));
});

function makeSyncEngine(overrides = {}) {
    const pending = [];
    const target = new EventTarget();
    const engine = new ProximityEngine({
        threshold: 150,
        eventTarget: target,
        getRects: () => ({ main: rect(0, 0, 100, 40), popover: rect(0, 50, 300, 200) }),
        raf: (cb) => { pending.push(cb); return pending.length; },
        cancelRaf: () => {},
        ...overrides,
    });
    const flush = () => {
        const copy = [...pending];
        pending.length = 0;
        copy.forEach((cb) => cb());
    };
    const move = (x, y, pointerType = 'mouse') =>
        target.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType, clientX: x, clientY: y }));
    return { engine, flush, move };
}

describe('ProximityEngine lifecycle', () => {
    it('never fires without mouse movement', () => {
        const onExceed = vi.fn();
        const { engine } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        engine.detach();
        expect(onExceed).not.toHaveBeenCalled();
    });

    it('ignores non-mouse pointers', () => {
        const onExceed = vi.fn();
        const { engine, flush, move } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        move(900, 900, 'touch');
        flush();
        expect(onExceed).not.toHaveBeenCalled();
        engine.detach();
    });

    it('distant bump before entering area neither arms nor fires', () => {
        const onExceed = vi.fn();
        const { engine, flush, move } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        move(900, 900);
        flush();
        expect(onExceed).not.toHaveBeenCalled();
        engine.detach();
    });

    it('arms after entering popover, fires beyond threshold', () => {
        const onExceed = vi.fn();
        const { engine, flush, move } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        move(150, 150);
        flush();
        expect(onExceed).not.toHaveBeenCalled();
        move(900, 900);
        flush();
        expect(onExceed).toHaveBeenCalledTimes(1);
        engine.detach();
    });

    it('reset clears point+armed: distant bump afterwards does not fire', () => {
        const onExceed = vi.fn();
        const { engine, flush, move } = makeSyncEngine({ onThresholdExceeded: onExceed });
        engine.attach();
        move(150, 150);
        flush();
        engine.reset();
        move(900, 900);
        flush();
        expect(onExceed).not.toHaveBeenCalled();
        engine.detach();
    });
});
