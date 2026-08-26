# CustomSelect

Современная замена стандартному HTML `<select>`: кастомный интерфейс выбора на **HTML Popover API**, без зависимостей, только для современных браузеров.

```js
import { CustomSelect } from 'custom-select';
import 'custom-select/index.css';

const select = new CustomSelect('#city', {
    items: [
        { id: 'msk', type: 'text', content: 'Москва' },
        { id: 'spb', type: 'text', content: 'Санкт-Петербург' },
        { id: 'kzn', type: 'text', content: 'Казань', group: 'Поволжье' },
    ],
});
```

## Возможности

- Одиночный и множественный выбор (теги, `maxLines`, кнопка «...» для переполнения)
- Поиск с 4 режимами: `contains`, `startsWith`, `exact`, `fuzzy` + подсветка совпадений
- Группировка элементов с заголовками
- Индивидуально отключённые элементы
- Состояния `disabled`, `readonly`, `loading`
- Реактивная конфигурация: `updateConfig()` применяется к уже открытому списку
- Динамическая замена элементов (`setItems`) и выбора (`setValue`)
- Массовые операции: выбрать всё / очистить
- Многоколоночный список с горизонтальной прокруткой
- Автопозиционирование над/под триггером, никогда не выходит за viewport
- Закрытие по клику вне и по отдалению курсора (proximity)
- Полная клавиатурная навигация и WAI-ARIA
- Несколько независимых экземпляров на странице
- Асинхронные события с изоляцией ошибок
- Тёмная тема, настраиваемая через CSS-переменные

## Требования

- Браузеры с HTML Popover API: Chrome 151+, Firefox 154+, Safari 26+
- ES Modules (UMD/IIFE не поставляются)
- Runtime-зависимостей нет

## Установка

Пакет ещё не опубликован в npm — устанавливается напрямую из репозитория или локальной папки:

```bash
# из локальной папки
npm install /path/to/custom-select

# из git-репозитория
npm install git+https://example.com/user/custom-select.git
```

После установки работают оба импорта:

```js
import { CustomSelect } from 'custom-select';            // класс
import { CustomSelect, VERSION } from 'custom-select'; // + версия
```

> **Стили обязательны.** Подключите их тегом в HTML:
>
> ```html
> <link rel="stylesheet" href="node_modules/custom-select/dist/index.css">
> ```
>
> Без стилей компонент работает, но выглядит как неоформленный div.

## Быстрый старт

### 1. Одиночный выбор

```html
<div id="fruit"></div>
<script type="module">
    import { CustomSelect } from 'custom-select';
    import 'custom-select/index.css';

    const select = new CustomSelect('#fruit', {
        items: [
            { id: 'apple',  type: 'text', content: 'Яблоко' },
            { id: 'banana', type: 'text', content: 'Банан' },
            { id: 'cherry', type: 'text', content: 'Черешня', disabled: true },
        ],
        placeholder: 'Выберите фрукт...',
    });

    // программное управление
    await select.setValue(['banana']);
    console.log(select.getValue()); // [{ id: 'banana', type: 'text', content: 'Банан' }]
</script>
```

Выбранное значение показывается текстом в триггере. Выбор другого элемента заменяет текущий и закрывает список.

### 2. Множественный выбор с тегами

```js
const select = new CustomSelect('#tags', {
    items: [
        /* ... */
    ],
    multiple: true,
    selectedIds: ['a', 'b'],   // начальный выбор
    maxLines: 2,               // до 2 строк тегов, остальное скрывается за «...»
    showSelectAll: true,       // 'Select all' button
});
```

Popover остаётся открытым при выборе; у каждого элемента — визуальный чекбокс; теги удаляются крестиком или клавишей Backspace.

### 3. Поиск

```js
const select = new CustomSelect('#searchable', {
    items,
    searchable: true,             // включён по умолчанию
    searchMode: 'fuzzy',          // contains | startsWith | exact | fuzzy
    highlightSearchMatches: true, // подсветить совпадения <mark>
});
```

Подробнее: [docs/search.md](docs/search.md).

### 4. Группы

Элементы с одинаковым `group` объединяются под общим заголовком в порядке первого появления:

```js
items: [
    { id: 1, type: 'text', content: 'Москва', group: 'Россия' },
    { id: 2, type: 'text', content: 'Казань', group: 'Россия' },
    { id: 3, type: 'text', content: 'Берлин', group: 'Германия' },
    { id: 4, type: 'text', content: 'Без группы' }, // блок без заголовка
]
```

## События

Все колбэки поддерживают `async` и выполняются последовательно:

```js
const select = new CustomSelect('#el', {
    items,
}, {
    onSelect(item)   { console.log('выбран', item.id); },
    onChange(items)  { console.log('текущий выбор:', items.map(i => i.id)); },
});

// или динамически:
select.on('change', (items) => { /* ... */ });
```

| Событие | Аргумент | Когда |
|---|---|---|
| `select` | item | Выбран элемент |
| `deselect` | item | Снят выбор |
| `change` | items[] | Любое изменение выбора |
| `open` / `close` | — | Открытие / закрытие списка |
| `search` | query, matched[] | Изменение поискового запроса |
| `clear` | — | Массовая очистка |

## Публичный API

| Метод | Описание |
|---|---|
| `open()` / `close()` / `toggle()` | Управление списком (async) |
| `getValue()` | Текущий выбор — массив items |
| `setValue(ids)` | Программная установка выбора (async) |
| `setItems(items)` | Замена списка элементов (async) |
| `updateConfig(patch)` | Реактивное обновление конфигурации (async) |
| `clear()` / `selectAll()` | Массовые операции (async) |
| `on(event, fn)` / `off(event, fn)` | Подписка на события |
| `destroy()` | Полная очистка DOM и слушателей |

Полное описание: [docs/api.md](docs/api.md).

## Документация

- [Быстрый старт](docs/getting-started.md) — установка, первое использование, структура
- [Конфигурация](docs/configuration.md) — все 26 опций с дефолтами
- [API](docs/api.md) — методы, ошибки, семантика disabled/readonly/loading
- [События](docs/events.md) — payloads, порядок эмиссии, обработка ошибок
- [Поиск](docs/search.md) — режимы, нормализация, подсветка
- [Клавиатура и доступность](docs/keyboard-and-a11y.md)
- [Темизация](docs/theming.md) — CSS-переменные, DOM-структура, классы
- [Примеры](docs/examples.md) — рецепты типовых сценариев

## Разработка

```bash
npm install
npm run dev        # демо-страница на http://localhost:5173
npm run build      # dist/ (ESM + CSS + d.ts)
npm run typecheck  # TypeScript checkJs
npm run test:unit  # Vitest
npm run test:e2e   # Playwright (chromium/firefox/webkit)
```
