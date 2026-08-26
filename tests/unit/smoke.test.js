import { describe, it, expect } from 'vitest';
import { CustomSelect, VERSION } from '../../src/index.js';

describe('smoke', () => {
    it('exposes version', () => {
        expect(VERSION).toBe('0.1.0');
    });

    it('exposes CustomSelect as default export', () => {
        expect(typeof CustomSelect).toBe('function');
        expect(CustomSelect.name).toBe('CustomSelect');
    });
});
