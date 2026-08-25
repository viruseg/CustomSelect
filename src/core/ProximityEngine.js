/**
 * @typedef {import('../types.js').SimpleRect} SimpleRect
 */

/**
 * Расстояние от точки до AABB (спека §50).
 * @param {number} x
 * @param {number} y
 * @param {SimpleRect} rect
 * @returns {number}
 */
export function pointDistanceToRect(x, y, rect) {
    const dx = Math.max(rect.left - x, 0, x - (rect.left + rect.width));
    const dy = Math.max(rect.top - y, 0, y - (rect.top + rect.height));
    return Math.hypot(dx, dy);
}

export default class ProximityEngine {
    #threshold;
    #getRects;
    #onThresholdExceeded;
    #rafFn;
    #cancelRafFn;
    #eventTarget;
    /** @type {(event: PointerEvent) => void} */
    #listener;
    #rafId = 0;
    /** @type {{x: number, y: number} | null} */
    #point = null;
    #armed = false;

    /**
     * @param {Object} opts
     * @param {number} opts.threshold
     * @param {() => {main: SimpleRect, popover: SimpleRect}} opts.getRects
     * @param {() => void} opts.onThresholdExceeded
     * @param {(cb: (time: number) => void) => number} [opts.raf]
     * @param {(id: number) => void} [opts.cancelRaf]
     * @param {EventTarget} [opts.eventTarget]
     */
    constructor({ threshold, getRects, onThresholdExceeded, raf, cancelRaf, eventTarget }) {
        this.#threshold = threshold;
        this.#getRects = getRects;
        this.#onThresholdExceeded = onThresholdExceeded;
        this.#rafFn = raf ?? ((cb) => requestAnimationFrame(cb));
        this.#cancelRafFn = cancelRaf ?? ((id) => cancelAnimationFrame(id));
        this.#eventTarget = eventTarget ?? window;
        this.#listener = (event) => this.#handlePointerMove(event);
    }

    attach() {
        this.reset();
        this.#eventTarget.addEventListener('pointermove', /** @type {EventListener} */ (this.#listener));
    }

    detach() {
        this.#eventTarget.removeEventListener('pointermove', /** @type {EventListener} */ (this.#listener));
        this.reset();
    }

    reset() {
        this.#point = null;
        this.#armed = false;
        if (this.#rafId) {
            this.#cancelRafFn(this.#rafId);
            this.#rafId = 0;
        }
    }

    /** @param {PointerEvent} event */
    #handlePointerMove(event) {
        if (event.pointerType !== 'mouse') return;
        this.#point = { x: event.clientX, y: event.clientY };
        if (this.#rafId) return;
        this.#rafId = this.#rafFn(() => {
            this.#rafId = 0;
            this.#evaluate();
        });
    }

    #evaluate() {
        const point = this.#point;
        if (!point) return;
        const { main, popover } = this.#getRects();
        const dMin = Math.min(
            pointDistanceToRect(point.x, point.y, main),
            pointDistanceToRect(point.x, point.y, popover),
        );
        if (!this.#armed) {
            if (dMin === 0) this.#armed = true;
            return;
        }
        if (dMin > this.#threshold) this.#onThresholdExceeded();
    }
}
