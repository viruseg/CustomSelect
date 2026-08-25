import { describe, it, expect } from 'vitest';
import { calculatePlacement } from '../../src/core/PositionEngine.js';

const vp = { width: 1000, height: 800 };
const pop = { left: 0, top: 0, width: 300, height: 250 };
const O = { offset: 4, maxHeight: 320, margin: 8 };

describe('vertical placement', () => {
    it('places below when space suffices', () => {
        const trig = { left: 100, top: 100, width: 200, height: 40 };
        const r = calculatePlacement(trig, pop, vp, O);
        expect(r.below).toBe(true);
        expect(r.top).toBe(trig.top + trig.height + 4);
        expect(r.left).toBe(100);
    });

    it('flips above when below is tight', () => {
        const trig = { left: 100, top: 700, width: 200, height: 40 };
        const r = calculatePlacement(trig, pop, vp, O);
        expect(r.below).toBe(false);
        expect(r.top + r.height).toBeLessThanOrEqual(trig.top - 4);
    });

    it('picks larger side and clamps inside viewport when both tight', () => {
        const trig = { left: 0, top: 380, width: 1000, height: 40 };
        const big = { left: 0, top: 0, width: 300, height: 600 };
        const r = calculatePlacement(trig, big, vp, { ...O, maxHeight: 600 });
        expect(r.top).toBeGreaterThanOrEqual(0);
        expect(r.top + r.height).toBeLessThanOrEqual(vp.height);
    });

    it('respects maxHeight cap', () => {
        const trig = { left: 0, top: 100, width: 100, height: 40 };
        const giant = { left: 0, top: 0, width: 200, height: 5000 };
        const r = calculatePlacement(trig, giant, vp, O);
        expect(r.height).toBeLessThanOrEqual(320);
    });
});

describe('horizontal placement', () => {
    it('clamps right overflow keeping margin', () => {
        const trig = { left: 850, top: 100, width: 140, height: 40 };
        const r = calculatePlacement(trig, pop, vp, O);
        expect(r.left + r.width).toBeLessThanOrEqual(vp.width - 8);
    });

    it('clamps width when popover wider than viewport', () => {
        const wide = { left: 0, top: 0, width: 2000, height: 200 };
        const r = calculatePlacement({ left: 100, top: 700, width: 200, height: 40 }, wide, vp, O);
        expect(r.width).toBe(vp.width - 16);
        expect(r.left).toBe(8);
    });

    it('never produces negative left', () => {
        const r = calculatePlacement({ left: 5, top: 100, width: 50, height: 40 }, pop, vp, O);
        expect(r.left).toBeGreaterThanOrEqual(8);
    });
});
