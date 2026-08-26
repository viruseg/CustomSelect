# Примеры и рецепты

## Загрузка данных с сервера (loading)

```js
const select = new CustomSelect('#host', {
    items: [],
    loading: true, // спиннер сразу
});

const res = await fetch('/api/cities');
const data = await res.json();

await select.updateConfig({
    items: data.map(c => ({ id: c.id, type: 'text', content: c.name, group: c.region })),
    loading: false,
});
```

`loading` реагирует мгновенно: если пользователь уже открыл список, он увидит смену спиннера на список без переоткрытия.

## Связанные селекторы (страна → город)

```js
const country = new CustomSelect('#country', { items: countries });
const city = new CustomSelect('#city', { items: [], disabled: true });

country.on('change', async (_instance, [selected]) => {
    if (!selected) return;
    city.updateConfig({ loading: true });
    const cities = await fetchCities(selected.id);
    await city.updateConfig({
        items: cities.map(c => ({ id: c.id, type: 'text', content: c.name })),
        disabled: false,
        loading: false,
    });
});
```

## Форма с сохранением черновика

```js
const tags = new CustomSelect('#tags', {
    items: allTags,
    multiple: true,
    maxLines: 2,
    selectedIds: draft.tagIds ?? [], // восстановление черновика
    showSelectAll: false,
});

window.addEventListener('beforeunload', () => {
    localStorage.setItem('draft', JSON.stringify({
        tagIds: tags.getValue().map(i => i.id),
    }));
});
```

## Динамическая подмена справочника без потери выбора

```js
// выбор сохранится для элементов, которые остались в новом списке
await select.setItems([
    { id: 'a', type: 'text', content: 'Осталась' },
    { id: 'd', type: 'text', content: 'Новая' },
]);
// если было выбрано 'a' — оно осталось выбранным
// исчезнувшие id снялись тихо, с событиями deselect + change
```

## Галерея изображений с поиском по тегам

```js
const gallery = new CustomSelect('#gallery', {
    items: photos.map(p => ({
        id: p.id,
        type: 'image',
        content: p.thumbnailUrl,          // src картинки; HTML не интерпретируется
        searchKeywords: p.tags,           // поиск только по ним, URL не ищется
        ariaLabel: p.title,               // доступное имя для скринридеров
        group: p.album,
    })),
    highlightSearchMatches: true,
    placeholder: 'Выберите фото...',
});
```

## Многоколоночный каталог

```js
new CustomSelect('#catalog', {
    items: products,
    columns: 3,             // сетка сверху вниз, прокрутка вправо
    modalMaxHeight: 280,
    searchable: false,      // фокус сразу на опциях при открытии
});
```

## Readonly-просмотр с возможностью поиска

```js
// пользователь может смотреть и искать, но не менять выбор
select.updateConfig({ readonly: true });
// программно значение по-прежнему можно установить:
await select.setValue(['fixed-value']);
```

## Несколько независимых экземпляров

```js
for (const host of document.querySelectorAll('.filter-select')) {
    new CustomSelect(host, {
        items: filterItems,
        multiple: true,
    });
}
```

Каждый экземпляр полностью изолирован: свои id, состояние, слушатели. Клик внутри одного закрывает другой (это обычный click-outside). Одновременно могут быть открыты несколько списков.

## Управление с клавиатуры целиком

```js
// открыть программно и передать управление пользователю
await select.open();

// сфокусировать триггер, чтобы работали Enter/ArrowDown/Backspace
document.querySelector('#host .csel-root').focus();
```

## Реакция на открытие/закрытие (аналитика)

```js
select.on('open', (_instance) => analytics.track('select_opened'));
select.on('close', (_instance) => analytics.track('select_closed'));
select.on('search', (_instance, q) => {
    if (q.length >= 3) analytics.track('search', { q });
});
```

## Корректное уничтожение (SPA-роутинг)

```js
let instance = null;

export function mountFilter(container, items) {
    instance?.destroy();               // снимает listeners/DOM/observers
    instance = new CustomSelect(container, { items });
}

export function unmountFilter() {
    instance?.destroy();
    instance = null;
}
```

После `destroy()` обращение к методам экземпляра бросает `Error` — держите ссылку актуальной.

## Тонкая настройка темы под бренд

```css
:root {
    --csel-accent: #10b981;
    --csel-accent-hover: #059669;
    --csel-border-focus: #10b981;
    --csel-radius: 10px;
    --csel-transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* скруглить чекбоксы под дизайн-систему */
.csel-checkbox { border-radius: 50%; }
```
