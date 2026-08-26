/** @returns {import('../types.js').CustomSelectItem[]} */
export function makeFruits() {
    return [
        // Fruits
        { id: 'apple', type: 'text', content: 'Apple', group: 'Fruits' },
        { id: 'apricot', type: 'text', content: 'Apricot', group: 'Fruits' },
        { id: 'banana', type: 'text', content: 'Banana', group: 'Fruits' },
        { id: 'cherry', type: 'text', content: 'Cherry', group: 'Fruits' },
        { id: 'grape', type: 'text', content: 'Grape', group: 'Fruits' },
        { id: 'kiwi', type: 'text', content: 'Kiwi', group: 'Fruits' },
        { id: 'lemon', type: 'text', content: 'Lemon', group: 'Fruits' },
        { id: 'mango', type: 'text', content: 'Mango', group: 'Fruits' },
        { id: 'orange', type: 'text', content: 'Orange', group: 'Fruits' },
        { id: 'peach', type: 'text', content: 'Peach', group: 'Fruits' },
        { id: 'pineapple', type: 'text', content: 'Pineapple', group: 'Fruits' },
        // Vegetables
        { id: 'carrot', type: 'text', content: 'Carrot', group: 'Vegetables' },
        { id: 'potato', type: 'text', content: 'Potato', disabled: true, group: 'Vegetables' },
        { id: 'tomato', type: 'text', content: 'Tomato', group: 'Vegetables' },
        { id: 'cucumber', type: 'text', content: 'Cucumber', group: 'Vegetables' },
        { id: 'onion', type: 'text', content: 'Onion', group: 'Vegetables' },
        { id: 'pepper', type: 'text', content: 'Pepper', group: 'Vegetables' },
        { id: 'radish', type: 'text', content: 'Radish', group: 'Vegetables' },
        { id: 'zucchini', type: 'text', content: 'Zucchini', group: 'Vegetables' },
        // Transport (search keywords)
        { id: 'red-car', type: 'text', content: 'Red Car', searchKeywords: ['vehicle', 'auto'] },
        { id: 'blue-bus', type: 'text', content: 'Blue Bus', searchKeywords: ['vehicle'] },
        { id: 'tram', type: 'text', content: 'City Tram', searchKeywords: ['vehicle', 'public'] },
    ];
}

const PALETTE = ['e11d48', '6366f1', '059669', 'd97706', '7c3aed'];

/** @returns {import('../types.js').CustomSelectItem[]} */
export function makeImages() {
    return PALETTE.map((hex, i) => ({
        id: i + 1,
        type: 'image',
        content: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='12' fill='%23${hex}'/></svg>`,
        searchKeywords: [`color-${i + 1}`, hex],
        ariaLabel: `Palette ${i + 1}`,
    }));
}

/** @returns {import('../types.js').CustomSelectItem[]} */
export function makeMany(n = 100) {
    return Array.from({ length: n }, (_, i) => ({
        id: i,
        type: 'text',
        content: `Item ${String(i + 1).padStart(3, '0')}`,
        group: i % 2 === 0 ? 'Even' : 'Odd',
        disabled: i === 50,
    }));
}
