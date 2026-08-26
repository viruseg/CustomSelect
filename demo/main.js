import { CustomSelect } from '../src/index.js';
import { makeFruits, makeImages, makeMany } from './data.js';

/** @param {string} name */
const log = (name) => (/** @type {string} */ event, /** @type {unknown} */ payload) =>
    console.info(`[${name}] ${event}`, payload);

/** @param {string} title */
function section(title) {
    const h = document.createElement('h2');
    h.textContent = title;
    document.getElementById('app')?.append(h);
    const box = document.createElement('div');
    box.className = 'demo-row';
    document.getElementById('app')?.append(box);
    return box;
}

// Single text
{
    const box = section('Single / text');
    const host = document.createElement('div');
    box.append(host);
    new CustomSelect(host, { items: makeFruits(), placeholder: 'Фрукт...' }, {
        onSelect: (i) => log('single')( 'select', i),
        onChange: (xs) => log('single')('change', xs),
    });
}

// Single image
{
    const box = section('Single / image');
    const host = document.createElement('div');
    box.append(host);
    new CustomSelect(host, { items: makeImages(), searchable: true });
}

// Multiple with tags/maxLines/clear/selectAll
{
    const box = section('Multiple / tags / maxLines=2 / select-all');
    const host = document.createElement('div');
    host.style.width = '420px';
    box.append(host);
    const sel = new CustomSelect(host, {
        items: makeFruits(),
        multiple: true,
        maxLines: 2,
        showSelectAll: true,
        selectedIds: ['apple', 'banana'],
    });
    const btn = document.createElement('button');
    btn.textContent = 'setValue([carrot, tomato])';
    btn.addEventListener('click', () => void sel.setValue(['carrot', 'tomato']));
    box.append(btn);
}

// Search modes demo (fuzzy + highlight)
{
    const box = section('Search fuzzy + highlight');
    const host = document.createElement('div');
    box.append(host);
    new CustomSelect(host, {
        items: makeMany(60),
        searchMode: 'fuzzy',
        highlightSearchMatches: true,
    });
}

// Multi-column layout
{
    const box = section('Layout / columns=3 horizontal scroll');
    const host = document.createElement('div');
    box.append(host);
    new CustomSelect(host, { items: makeMany(80), columns: 3, modalMaxHeight: 240 });
}

// Dynamic config
{
    const box = section('Dynamic updateConfig');
    const host = document.createElement('div');
    box.append(host);
    const sel = new CustomSelect(host, { items: makeFruits() });
    let on = false;
    const btn = document.createElement('button');
    btn.textContent = 'toggle disabled/readonly/loading';
    btn.addEventListener('click', () => {
        on = !on;
        void sel.updateConfig(on ? { loading: true } : { loading: false });
    });
    box.append(btn);
}

// Three independent instances
{
    const box = section('Instances isolation x3');
    for (let i = 0; i < 3; i++) {
        const host = document.createElement('div');
        box.append(host);
        new CustomSelect(host, { items: makeFruits(), multiple: i % 2 === 1 });
    }
}
