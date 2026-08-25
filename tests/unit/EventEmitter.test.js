import { describe, it, expect, vi } from 'vitest';
import EventEmitter from '../../src/core/EventEmitter.js';

describe('EventEmitter', () => {
    it('calls handlers in registration order', async () => {
        const em = new EventEmitter();
        const order = [];
        em.on('x', () => order.push(1));
        em.on('x', () => order.push(2));
        await em.emit('x');
        expect(order).toEqual([1, 2]);
    });

    it('awaits async handlers sequentially', async () => {
        const em = new EventEmitter();
        const order = [];
        em.on('x', async () => {
            await new Promise((r) => setTimeout(r, 20));
            order.push('slow-first');
        });
        em.on('x', () => order.push('fast-second'));
        await em.emit('x');
        expect(order).toEqual(['slow-first', 'fast-second']);
    });

    it('ignores duplicate registration of same handler', async () => {
        const em = new EventEmitter();
        const h = vi.fn();
        em.on('x', h);
        em.on('x', h);
        await em.emit('x');
        expect(h).toHaveBeenCalledTimes(1);
    });

    it('off removes handler', async () => {
        const em = new EventEmitter();
        const h = vi.fn();
        em.on('x', h);
        em.off('x', h);
        await em.emit('x');
        expect(h).not.toHaveBeenCalled();
    });

    it('continues after sync handler error and logs once', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const em = new EventEmitter();
        const good = vi.fn();
        em.on('x', () => { throw new Error('boom'); });
        em.on('x', good);
        await expect(em.emit('x')).resolves.toBeUndefined();
        expect(good).toHaveBeenCalledTimes(1);
        expect(errSpy).toHaveBeenCalledTimes(1);
        errSpy.mockRestore();
    });

    it('awaits errored async handler before continuing others', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const em = new EventEmitter();
        const order = [];
        em.on('x', async () => {
            await new Promise((r) => setTimeout(r, 10));
            throw new Error('late boom');
        });
        em.on('x', () => order.push('after'));
        await em.emit('x');
        expect(order).toEqual(['after']);
        errSpy.mockRestore();
    });

    it('rejects non-function handler', () => {
        const em = new EventEmitter();
        expect(() => em.on('x', /** @type {any} */ (null))).toThrow(TypeError);
    });
});
