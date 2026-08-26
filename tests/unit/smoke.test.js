import { describe, it, expect } from 'vitest';
import { CustomSelect, CUSTOM_SELECT_VERSION } from '../../src/index.js';

describe('smoke', () => {
    it('exposes version under unambiguous name', () => {
        expect(CUSTOM_SELECT_VERSION).toBe('0.1.0');
    });

    it('exposes CustomSelect class export', () => {
        expect(typeof CustomSelect).toBe('function');
        expect(CustomSelect.name).toBe('CustomSelect');
    });
});
