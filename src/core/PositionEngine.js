/**
 * @typedef {import('../types.js').SimpleRect} SimpleRect
 * @typedef {import('../types.js').PlacementResult} PlacementResult
 */

/**
 * Чистая функция позиционирования popover относительно триггера (спека §46–48).
 * @param {SimpleRect} triggerRect
 * @param {SimpleRect} popoverRect intrinsic size
 * @param {{width: number, height: number}} viewport
 * @param {Object} [opts]
 * @param {number} [opts.offset=4]
 * @param {number} [opts.maxHeight=320]
 * @param {number} [opts.margin=8]
 * @returns {PlacementResult}
 */
export function calculatePlacement(triggerRect, popoverRect, viewport, opts = {}) {
    const offset = opts.offset ?? 4;
    const maxHeight = opts.maxHeight ?? 320;
    const margin = opts.margin ?? 8;

    const desiredHeight = Math.min(popoverRect.height, maxHeight);
    const availBelow = viewport.height - triggerRect.top - triggerRect.height - offset - margin;
    const availAbove = triggerRect.top - offset - margin;
    const below = availBelow >= desiredHeight ? true : availAbove >= desiredHeight ? false : availBelow >= availAbove;

    const height = Math.max(Math.min(desiredHeight, below ? availBelow : availAbove), 0);
    const top = below
        ? triggerRect.top + triggerRect.height + offset
        : triggerRect.top - offset - height;

    const maxWidth = viewport.width - margin * 2;
    const width = Math.min(popoverRect.width, maxWidth);
    let left = triggerRect.left;
    if (left + width > viewport.width - margin) left = viewport.width - margin - width;
    if (left < margin) left = margin;

    return { left, top, width, height, below };
}
