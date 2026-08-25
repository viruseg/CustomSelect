/**
 * @typedef {{id: string|number, disabled?: boolean, element?: {scrollIntoView?: Function}}} NavOption
 * @typedef {{options: NavOption[], rowCount: number|null, activeId: string|number|null}} NavModel
 */

export default class KeyboardNav {
    #getModel;
    #setActiveId;
    #onSelectIntent;
    #onRequestClose;

    /**
     * @param {Object} hooks
     * @param {() => NavModel} hooks.getModel
     * @param {(id: string|number|null) => void} hooks.setActiveId
     * @param {(id: string|number) => void} hooks.onSelectIntent
     * @param {() => void} hooks.onRequestClose
     */
    constructor({ getModel, setActiveId, onSelectIntent, onRequestClose }) {
        this.#getModel = getModel;
        this.#setActiveId = setActiveId;
        this.#onSelectIntent = onSelectIntent;
        this.#onRequestClose = onRequestClose;
    }

    /** @param {KeyboardEvent} event */
    handleKeyDown(event) {
        const model = this.#getModel();
        const { options } = model;
        if (options.length === 0 && event.key !== 'Escape') return;

        const index = options.findIndex((o) => o.id === model.activeId);
        /** @type {number|null} */
        let target = null;

        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                this.#onRequestClose();
                return;
            case 'Home': {
                target = this.#scan(options, 0, 1);
                break;
            }
            case 'End': {
                target = this.#scan(options, options.length - 1, -1);
                break;
            }
            case 'ArrowDown': {
                target = this.#step(options, index, model.rowCount ?? 1);
                break;
            }
            case 'ArrowUp': {
                target = this.#step(options, index, -(model.rowCount ?? 1));
                break;
            }
            case 'ArrowRight': {
                if (model.rowCount === null) return;
                target = this.#step(options, index, 1);
                break;
            }
            case 'ArrowLeft': {
                if (model.rowCount === null) return;
                target = this.#step(options, index, -1);
                break;
            }
            case 'Enter':
            case ' ': {
                if (index >= 0 && options[index]?.disabled !== true) {
                    event.preventDefault();
                    this.#onSelectIntent(/** @type {NavOption} */ (options[index]).id);
                }
                return;
            }
            default:
                return;
        }

        event.preventDefault();
        if (target !== null && target !== index) this.#activate(/** @type {NavOption} */ (options[target]));
    }

    /**
     * Сдвиг с пропуском disabled и clamp без wrap.
     * @param {NavOption[]} options
     * @param {number} index текущий (-1 если нет)
     * @param {number} delta
     * @returns {number|null}
     */
    #step(options, index, delta) {
        if (index < 0) {
            return delta > 0 ? this.#scan(options, 0, 1) : this.#scan(options, options.length - 1, -1);
        }
        let next = index + delta;
        const direction = Math.sign(delta);
        while (next >= 0 && next < options.length && options[next]?.disabled === true) {
            next += direction;
        }
        if (next < 0 || next >= options.length) return null;
        return next;
    }

    /**
     * Первый enabled начиная с from в направлении dir.
     * @param {NavOption[]} options
     * @param {number} from
     * @param {number} dir
     * @returns {number|null}
     */
    #scan(options, from, dir) {
        let i = from;
        while (i >= 0 && i < options.length && options[i]?.disabled === true) i += dir;
        return i >= 0 && i < options.length ? i : null;
    }

    /** @param {NavOption} option */
    #activate(option) {
        this.#setActiveId(option.id);
        option.element?.scrollIntoView?.({ block: 'nearest' });
    }
}
