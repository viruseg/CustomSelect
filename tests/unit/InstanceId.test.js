import { describe, it, expect } from 'vitest';
import { nextInstanceId } from '../../src/core/InstanceId.js';

describe('nextInstanceId', () => {
    it('generates monotonically increasing ids', () => {
        const a = nextInstanceId();
        const b = nextInstanceId();
        expect(a).toMatch(/^csel-\d+$/);
        expect(Number(b.slice(5))).toBe(Number(a.slice(5)) + 1);
    });

    it('never repeats within many calls', () => {
        const seen = new Set(Array.from({ length: 100 }, () => nextInstanceId()));
        expect(seen.size).toBe(100);
    });
});
