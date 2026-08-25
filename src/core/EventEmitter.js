export default class EventEmitter {
    /** @type {Map<string, Set<Function>>} */
    #handlers = new Map();

    /**
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
        if (typeof handler !== 'function') {
            throw new TypeError(`Invalid handler for event "${event}": expected function.`);
        }
        let set = this.#handlers.get(event);
        if (!set) {
            set = new Set();
            this.#handlers.set(event, set);
        }
        set.add(handler);
    }

    /**
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
        this.#handlers.get(event)?.delete(handler);
    }

    /**
     * Последовательное выполнение; ошибки изолируются.
     * @param {string} event
     * @param {...unknown} args
     * @returns {Promise<void>}
     */
    async emit(event, ...args) {
        const set = this.#handlers.get(event);
        if (!set || set.size === 0) return;
        for (const handler of [...set]) {
            try {
                await handler(...args);
            } catch (error) {
                console.error(`[CustomSelect] Event handler failed for "${event}"`, error);
            }
        }
    }
}
