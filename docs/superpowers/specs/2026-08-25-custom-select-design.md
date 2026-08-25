# Custom Select Component Library — Консолидированная спецификация

**Дата:** 2026-08-25
**Статус:** Утверждена по итогам мозгового штурма (13 решений зафиксированы, см. Приложение A)
**Базовый документ:** ТЗ от 2026-08-25 с внесёнными поправками

---

## 1. Назначение проекта

Самостоятельная zero-runtime-dependency JavaScript-библиотека, заменяющая стандартный HTML `<select>` современным кастомным интерфейсом выбора.

Библиотека не использует DOM-элемент `<select>` под капотом и не синхронизируется с HTML-формами. Пользователь передаёт массив элементов с уникальными идентификаторами и контентом; библиотека сама создаёт DOM и управляет состоянием.

Возможности: одиночный и множественный выбор; текстовый/графический контент; поиск (4 режима); группировка; индивидуально отключённые элементы; `disabled`/`readonly`/`loading`; динамическая замена items и конфигурации (в т.ч. на открытом popover); массовые выбор/очистка; многоколоночный список с горизонтальной прокруткой; авто-позиционирование; click-outside; proximity-закрытие; клавиатурная навигация; WAI-ARIA; HTML Popover API; несколько независимых экземпляров; асинхронные события; тёмная тема.

Только современные браузеры. Legacy-совместимость не требуется.

---

## 2. Технологические ограничения

### 2.1. Браузеры (обновлено)

Минимальные поддерживаемые версии — актуальные стабильные на момент старта проекта:

- **Chrome 151+**
- **Firefox 154+**
- **Safari 26+**

Используются современные Web Platform API без полифиллов и fallback'ов. HTML Popover API обязателен: `popover="manual"` помещает элемент в top layer, снимая ограничения `overflow`, `position` и stacking context.

Проверка поддержки Popover выполняется при инициализации. При отсутствии API — контролируемая ошибка `NotSupportedError`/`Error` с понятным сообщением. Автоматического fallback нет.

Поскольку минимумы подняты, `@starting-style` и `transition-behavior: allow-discrete` гарантированно доступны во всех целевых браузерах — анимации popover'а реализуются через них без graceful-degradation веток.

### 2.2. JavaScript

ES2022+ / ECMAScript Latest. Запрещены: транспиляция ради legacy, полифиллы, устаревшие API без нужды, сторонние runtime-библиотеки.

Используются: ES Modules, private class fields, `Set`, `Map`, `AbortController` (где полезно), `ResizeObserver`, `requestAnimationFrame`, HTML Popover API, современные DOM API.

### 2.3. Зависимости

Runtime dependencies: **0**. Весь функциональный код реализуется самостоятельно.

Dev dependencies разрешены только для разработки/типизации/тестов/сборки: Vite, TypeScript (`checkJs`), **Vitest**, **Playwright**. Ни одна runtime-функция от них не зависит.

### 2.4. Сборка

Сборщик — Vite. Единственный distribution format — **ESM** (legacy-браузеры не поддерживаются, UMD/IIFE не добавляются).

Результат:

```text
dist/
├── index.js
├── index.css
└── index.d.ts
```

Работают оба варианта импорта:

```js
import CustomSelect from 'custom-select';
import CustomSelect, { ... } from 'custom-select';
```

---

## 3. Типизация

Весь исходный JS строго проверяется через TypeScript `checkJs`.

```json
{
    "compilerOptions": {
        "allowJs": true,
        "checkJs": true,
        "noEmit": true,
        "target": "ESNext",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "strict": true,
        "noImplicitAny": true,
        "noUncheckedIndexedAccess": true
    },
    "include": ["src/**/*.js"]
}
```

Все публичные и внутренние структуры имеют JSDoc (`@typedef`, `@template`, `@param`, `@returns`, `@throws`, `@type`). Запрещены неявно типизированные пустые объектные литералы и `any`. После сборки `.d.ts` генерируется из JSDoc.

---

## 4. Модель данных

### 4.1. Тип контента

```js
/**
 * @typedef {'text' | 'image'} ItemContentType
 */
```

### 4.2. Элемент

```js
/**
 * @typedef {Object} CustomSelectItem
 * @property {string | number} id
 * @property {ItemContentType} type
 * @property {string} content
 * @property {string[]} [searchKeywords]
 * @property {boolean} [disabled]
 * @property {string} [group]
 * @property {string} [ariaLabel]
 */
```

Правила:

- `id` обязан быть уникальным; `1` и `"1"` — различные идентификаторы.
- Для `items` проверяется отсутствие duplicate IDs; при дублях операция отклоняется целиком, состояние не меняется.
- `content`: для `text` отображается как текстовый узел; для `image` используется как `img.src`.
- HTML из `content` никогда не интерпретируется. `innerHTML` для пользовательских данных запрещён.

### 4.3. Изображения

Изображения не растягиваются, не обрезаются, сохраняют пропорции: `object-fit: contain`, максимально доступная область контейнера (см. §6.6 — бокс опции фиксирован).

Атрибут `alt` у `img` намеренно отсутствует. Доступное имя несёт сам `role="option"`:

1. `ariaLabel`, если указан;
2. иначе `searchKeywords.join(', ')`;
3. иначе `String(id)`.

`img` декоративен относительно accessibility tree.

### 4.4. Группы

`group` — идентификатор/название визуальной группы. Одинаковые значения объединяются в одну группу в порядке первого появления в исходном массиве; порядок элементов внутри группы сохраняется. Элемент без `group` попадает в специальную безымянную область без заголовка. Повторное появление того же `group` второй визуальной группы не создаёт.

---

## 5. Конфигурация

```js
/**
 * @typedef {'contains' | 'startsWith' | 'exact' | 'fuzzy'} SearchMode
 */

/**
 * @typedef {Object} CustomSelectConfig
 *
 * @property {CustomSelectItem[]} items
 * @property {(string|number)[]} [selectedIds=[]]
 * @property {boolean} [multiple=false]
 *
 * @property {string} [placeholder='Выберите значение...']
 *
 * @property {number} [maxLines=1]
 * @property {number} [lineHeight=36]
 *
 * @property {number|string} [mainWidth='100%']
 *
 * @property {number|string} [modalWidth='auto']
 * @property {number} [modalMaxHeight=320]
 * @property {number} [modalOffset=4]
 *
 * @property {number} [columns=1]
 * @property {number} [columnGap=8]
 *
 * @property {boolean} [searchable=true]
 * @property {SearchMode} [searchMode='contains']
 * @property {boolean} [searchCaseSensitive=false]
 * @property {string} [emptySearchText='Ничего не найдено']
 * @property {string} [emptyListText='Нет доступных элементов']
 *
 * @property {boolean} [showClearAll=true]
 * @property {boolean} [showSelectAll=false]
 *
 * @property {boolean} [disabled=false]
 * @property {boolean} [readonly=false]
 * @property {boolean} [loading=false]
 *
 * @property {boolean} [animations=true]
 *
 * @property {number} [cursorDistanceThreshold=150]
 *
 * @property {boolean} [showSelectedItems=true]
 * @property {boolean} [highlightSearchMatches=false]
 */
```

### Значения конфигурации

**`items`** — массив доступных элементов. Не мутируется библиотекой; при `setItems()` создаётся внутреннее представление.

**`selectedIds`** — начальный выбор. В single mode допускается максимум один ID; несколько при `multiple=false` → `TypeError`. Неизвестные ID → `Error` (fail-fast).

**`multiple`**:
- `false`: ровно один выбранный элемент или ни один; выбор закрывает popover сразу;
- `true`: несколько выбранных; popover остаётся открыт; у элементов визуальный checkbox; доступны массовые операции.

Переключение `multiple: true → false` на живом экземпляре: из выбранных остаётся **первый по порядку выбора**, остальные снимаются; после мутации — один `onChange`.

---

## 6. Геометрия и размеры

### 6.1. Основной модуль

Занимает `mainWidth`, допускает изменение ширины родителя; `ResizeObserver` пересчитывает видимые теги.

### 6.2. `maxLines`

Только multiple mode. Алгоритм:

1. render selected items;
2. layout браузера;
3. измерение фактических `offsetTop`;
4. определение последнего item, целиком укладывающегося в `maxLines`;
5. скрытие overflow;
6. резервирование места под кнопку `...`;
7. повторное измерение (кнопка `...` сужает доступную ширину);
8. отображение минимально необходимого числа скрытых элементов.

Полагаться только на `lineHeight * maxLines` нельзя. `ResizeObserver` пересчитывает при изменении ширины основного модуля.

### 6.3. Кнопка `...`

Показывается только при наличии скрытых selected items. Число скрытых текстом не отображается. Клик открывает popover.

### 6.4. Clear All

При `showClearAll=true` и непустом выборе — видима. Пустой выбор: скрыта/disabled, клики не порождают событий. `clear()` очищает selection независимо от query.

### 6.5. Popover width

`modalWidth='auto'`: минимальная ширина popover — ширина триггера; максимум — viewport за вычетом configurable margins (§48). Явное число/строка применяются как CSS width с теми же clamp-правилами.

### 6.6. Высота опции (новое)

Высота каждой опции **фиксирована** и выводится из `lineHeight`. Переполнение текста обрезается `text-overflow: ellipsis` (без переноса). Изображения вписываются в тот же бокс через `object-fit: contain`. Следствие: `rows = floor(availableHeight / optionHeight)` — детерминированная геометрия для сетки, клавиатурной навигации и позиционирования.

---

## 7. Disabled и Readonly

### `disabled`

Полностью отключает пользовательское взаимодействие: trigger не открывается; keyboard interaction недоступна; remove buttons, clear/select-all недоступны; элементы не выбираются; открытый popover немедленно закрывается; DOM-фокус недоступен; `aria-disabled=true`.

Программные API (`setValue`, `setItems`, `updateConfig`) продолжают работать.

### `readonly`

Просмотр разрешён, изменение запрещено.

Разрешено: открыть/закрыть popover, поиск, перемещение клавиатурой, просмотр групп, прокрутка.

Запрещено: выбирать, снимать выбор, очищать, Select All.

Batch-кнопки (Select All/Clear) и remove buttons переводятся в состояние **disabled** (не скрываются — без прыжков layout). Программные API продолжают работать.

---

## 8. Loading

`loading=true` — внешний код обновляет данные.

- trigger можно открыть; popover отображается;
- вместо списка — loader;
- выбор элементов и массовые действия блокируются (batch-кнопки — `disabled`);
- search input остаётся видимым, но переходит в `disabled`; введённый query **сохраняется**, результаты восстанавливаются после `updateConfig({ loading: false })`;
- закрытие разрешено.

---

## 9. Архитектура компонентов

```text
src/
├── index.js
├── types.js
├── styles/
│   ├── variables.css
│   ├── main-module.css
│   ├── modal-module.css
│   ├── animations.css
│   └── index.css
└── core/
    ├── CustomSelect.js
    ├── EventEmitter.js
    ├── ConfigManager.js
    ├── StateManager.js
    ├── DomRenderer.js
    ├── PositionEngine.js
    ├── ProximityEngine.js
    ├── KeyboardNav.js
    ├── SearchEngine.js
    └── InstanceId.js
```

---

## 10. State Model

```js
/**
 * @typedef {'closed' | 'opening' | 'open' | 'closing' | 'destroyed'} OpenState
 */

/**
 * @typedef {Object} InternalState
 * @property {CustomSelectItem[]} items
 * @property {Set<string|number>} selectedIds
 * @property {string} query
 * @property {OpenState} openState
 * @property {string|number|null} activeId
 * @property {boolean} disabled
 * @property {boolean} readonly
 * @property {boolean} loading
 */
```

`Set` выбран потому, что ID уникальны, проверка принадлежности O(1), порядок вставки сохраняется. Порядок selected IDs — **порядок выбора**: `select(A); select(B); deselect(A); select(A)` даёт `B, A`.

---

## 11. Lifecycle

```text
closed → opening → open → closing → closed
destroyed — терминальное состояние
```

### `open()`

1. проверить `destroyed`;
2. если `disabled` — ничего не делать;
3. если `open` — вернуть успешно завершённый Promise;
4. если `opening` — вернуть существующий Promise операции;
5. сохранить текущий trigger rect;
6. обновить содержимое;
7. позиционировать popover;
8. вызвать `showPopover()`;
9. дождаться фактического `toggle` события;
10. перейти в `open`;
11. активировать outside-click listener, proximity listener (со сбросом сохранённых координат курсора — см. §50), resize listener;
12. определить initial focus по матрице §24;
13. вызвать `onOpen`.

Native Popover сообщает о состоянии через `beforetoggle`/`toggle`; внутренний state не полагается только на факт вызова `showPopover()`.

### `close()`

1. если `closed` — no-op;
2. если `closing` — вернуть текущий Promise;
3. перейти в `closing`;
4. отключить proximity/resize/outside listeners;
5. вызвать `hidePopover()`;
6. дождаться `toggle`;
7. вернуть фокус на toggle button;
8. очистить active item;
9. очистить поисковый запрос;
10. перейти в `closed`;
11. вызвать `onClose`.

### `toggle()`

Если `open`/`opening` — закрыть; если `closed`/`closing` — открыть. Конфликтующие переходы сериализуются.

### `destroy()`

Закрывает popover (форсированно, даже если transition в процессе), снимает все listeners, удаляет popover DOM и внутренний DOM, освобождает references, отменяет pending RAF/timers, переводит экземпляр в `destroyed`. После `destroy()` все публичные методы кроме повторного `destroy()` бросают `Error`.

---

## 12. EventEmitter

API: `on(event, handler)`, `off(event, handler)`, `emit(event, ...args)`.

- Каждый handler потенциально async; выполняются **последовательно** (`for ... await`).
- Ошибка handler'а перехватывается, логируется через `console.error`, остальные handlers продолжаются; `emit()` резолвится после завершения всех handlers. Исключение callback не ломает внутреннее состояние и не откатывает его.
- Повторная регистрация одного handler на одно событие невозможна (Set-семантика).
- `on`/`off` доступны и публично на экземпляре (§63): конструкторный объект `events` — удобная сокращённая форма, динамическая подписка — через публичные методы.

---

## 13–14. Публичные события и их семантика

```js
/**
 * @typedef {Object} SelectEvents
 * @property {(item: CustomSelectItem) => Promise<void> | void} [onSelect]
 * @property {(item: CustomSelectItem) => Promise<void> | void} [onDeselect]
 * @property {(items: CustomSelectItem[]) => Promise<void> | void} [onChange]
 * @property {() => Promise<void> | void} [onOpen]
 * @property {() => Promise<void> | void} [onClose]
 * @property {(query: string, matched: CustomSelectItem[]) => Promise<void> | void} [onSearch]
 * @property {() => Promise<void> | void} [onClear]
 */
```

Одиночный выбор: `state mutation → onSelect(item) → onChange(selectedItems) → close()`.
Снятие выбора: `state mutation → onDeselect(item) → onChange(selectedItems)`.
Multiple: на каждое действие — `onSelect`/`onDeselect`, затем один `onChange`.
`clear()`: одна массовая операция, без per-item `onDeselect`: `state.clear() → onClear() → onChange([])`.
`selectAll()`: одна массовая операция: `state.selectAll() → onChange(allSelected)`.
`setValue()`: сравнение старого/нового состояния; для изменившихся элементов `onSelect`/`onDeselect`, затем один `onChange`.

---

## 15. StateManager

Методы: `select(id)`, `deselect(id)`, `toggle(id)`, `selectAll(ids?)`, `clear()`, `setItems(items)`, `setValue(ids)`, `getValue()`.

### `select(id)`

Ошибка, если: ID неизвестен; item disabled.

**Single mode: новый выбор всегда заменяет старый** (решение мозгового штурма №1). Инвариант «максимум один ID» соблюдается автоматически.

### Прочие

- `deselect(id)`: ID не выбран — no-op.
- `toggle(id)`: select/deselect по текущему состоянию.
- `selectAll()`: выбираются все **enabled** элементы. При активном search query — только по текущим результатам поиска (пример: 100 items, query="car", 12 matched → выбираются до 12 enabled matched). При пустом query — все enabled.
- `clear()`: полная очистка selection.

---

## 16. `setItems()`

Новый список полностью валидируется до изменения state.

1. duplicate IDs → ошибка;
2. invalid item → ошибка;
3. сопоставление текущего selection с новым списком;
4. исчезнувшие IDs тихо удаляются из selected state;
5. сохранившиеся IDs остаются выбранными.

Если selection изменился из-за удаления items — `onChange` + соответствующие `onDeselect` для исчезнувших.

Порядок: `validate → calculate removed → replace items → sanitize selectedIds → rerender → emit selection events`. Ошибка валидации полностью сохраняет старое состояние.

---

## 17. `setValue(ids)`

Single mode: `setValue([A])` разрешён; `setValue([A, B])` → `TypeError`.
Неизвестные IDs запрещены → `Error`.
Disabled IDs могут быть установлены программно: `disabled` запрещает пользовательское действие, но не программную установку.

---

## 18. `getValue()`

Возвращает `CustomSelectItem[]` в порядке `selectedIds`. Новый массив; внешняя мутация не затрагивает внутренний state.

---

## 19. ConfigManager

Ответственность: defaults, validation, normalization, partial update, уведомление о различиях. `updateConfig(Partial<CustomSelectConfig>)`; после применения всегда существует полный валидный config.

**Делегирование (решение №13):** `updateConfig({ items })` и `updateConfig({ selectedIds })` выполняются через те же пайплайны, что `setItems()`/`setValue()` — полная валидация, события, частичный rerender. Отдельного «сырого» пути записи этих полей нет.

### Validation

Ошибки: `columns < 1`; `maxLines < 1`; `lineHeight <= 0`; `modalMaxHeight <= 0`; `columnGap < 0`; `cursorDistanceThreshold < 0`; invalid `searchMode`; duplicate item IDs; invalid item types; несколько selected IDs при `multiple=false`. `NaN`/`Infinity` для числовых параметров запрещены. Unknown config properties игнорируются.

---

## 20. Reactivity

`updateConfig()` немедленно обновляет DOM даже при открытом popover. Немедленно применяются: `columns`, `modalWidth`, `modalMaxHeight`, `columnGap`, `searchable`, `maxLines`, `lineHeight`, `placeholder`, `showClearAll`, `showSelectAll`, `disabled`, `readonly`, `loading`.

При изменении геометрии: `rerender region → recalculate layout → recalculate position`. Сохраняются: текущий selection; query (если search включён); scrollLeft насколько возможно; active item, если существует; keyboard focus; popover остаётся открытым.

---

## 21–22. Основной модуль и поведение

Root container — **не** `<button>` (внутри вложенные interactive buttons ломают семантику):

```text
Root
├── Selected Items Container   ← только multiple
│   ├── Pill (Content + Remove Button)
│   └── Overflow Button "..."
├── Selected Value Text        ← single mode (текст контента выбранного)
├── Placeholder
├── Clear All Button
└── Toggle Button
```

Клик: пустое место / selected item / `...` → open; toggle button → toggle; remove button → только remove без открытия (stopPropagation); clear → clear без toggle (stopPropagation).

**Single mode UI (решение №5):** выбранное значение рендерится простым текстом контента опции (не тегом). Снятие выбора — clear-кнопка (`showClearAll`) или выбор другого элемента. Remove-кнопки и pills в single mode отсутствуют.

---

## 23. Keyboard behavior основного модуля

На сфокусированном root:

| Клавиша | Действие |
|---|---|
| `Enter` | open |
| `Space` | open |
| `ArrowDown` | open + активировать первую selectable option |
| `ArrowUp` | open + активировать последнюю selectable option |
| `Backspace` | удалить последний selected item (только multiple) |
| `Escape` | close, если открыт |

`Backspace` не срабатывает при фокусе внутри search input или другой интерактивной кнопке.

---

## 24. Начальный фокус (решение №2)

Матрица начального фокуса/активации:

| Способ открытия | `searchable=true` | `searchable=false` |
|---|---|---|
| Клик / toggle button / `Enter` / `Space` | DOM-фокус → search input; active = null | DOM-фокус → listbox (якорь); active = первый selectable option |
| `ArrowDown` на root | DOM-фокус → listbox; active = первый option | то же |
| `ArrowUp` на root | DOM-фокус → listbox; active = последний option | то же |

`ArrowDown` из search input переносит активность на первую selectable option (фокус остаётся на якоре — см. §40a).

---

## 28–30. Popover

Popover создаётся как `<div popover="manual">` — единственный контейнер списка экземпляра, собственный DOM node и уникальный ID на instance.

`manual` выбран намеренно: библиотека сама контролирует click-outside, proximity и lifecycle.

DOM монтируется непосредственно в `document.body` (или другой гарантированно верхнеуровневый контейнер). Отображение после `showPopover()` — в top layer. iframe/cross-document не поддерживаются.

Структура:

```text
Popover
├── Search Header (icon, input[type=search], clear-search button)
├── Batch Actions (Select All, Clear)
└── Listbox
    ├── Group (Group Header + Options…)
    └── Empty/Loading State
```

---

## 31–38. Поиск

Search input присутствует при `searchable === true`.

Ввод query: `SearchEngine` вычисляет matched → список обновляется → active корректируется → `onSearch(query, matched)`. Query хранится во внутреннем state; при закрытии очищается; при повторном открытии input пуст.

### Normalization

По умолчанию: case-insensitive, `trim()` query, Unicode NFKC. При `searchCaseSensitive=true` case-normalization не выполняется.

### Режимы

- `contains`: подстрока.
- `startsWith`: совпадение с начала строки.
- `exact`: полное совпадение после normalization.
- `fuzzy`: subsequence matching — символы query встречаются в text в том же порядке, не обязательно подряд. Не Levenshtein: similarity scoring не нужен при ~100 элементах.

### Семантика по полям и токенам (решение №9)

Query разделяется по whitespace. Семантика: **OR по полям внутри токена × AND между токенами**.

- Токен матчится, если найден хотя бы в одном поле элемента (для `text`: `content` или `searchKeywords`; для `image`: только `searchKeywords`).
- Матч элемента = все токены сматчились.
- Fuzzy применяется к каждому токену независимо.

Пример: `content="Red Car"`, `keywords=["vehicle"]`, запрос `"red vehicle"` → матч.

### Результаты

Исходный порядок items сохраняется; сортировка по score отсутствует. Selected items по умолчанию **не скрываются** (возможность снять выбор прямо из списка); `showSelectedItems=false` скрывает выбранные из результатов.

### Highlighting (решение №12.5)

`highlightSearchMatches=true`: подсвечиваются позиции совпавших символов каждого токена (для fuzzy — позиции subsequence). Rendering безопасный: текст разбивается на `text node / highlight span / text node` без `innerHTML`.

### Empty States (три разных)

- `loading=true` → spinner;
- items отсутствуют или все disabled → `emptyListText`;
- query ничего не нашёл → `emptySearchText`.

---

## 39–40a. Accessibility model

Основной модуль: `role="group"`. Toggle button: `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls=popover-id`. `role="combobox"` для триггера не используется (он не editable textbox; searchable textbox — отдельный control внутри popover).

Listbox: `role="listbox"`; multiple → `aria-multiselectable="true"`. Options: `role="option"`, `aria-selected`, `aria-disabled`. Checkbox в multiple — чисто визуальный, не интерактивный control; клик по всему option переключает состояние. Search: `input[type="search"]` с доступным label.

### Активная опция (решение №3)

Механизм отслеживания — **`aria-activedescendant`**, не roving tabindex.

- Якорь DOM-фокуса: search input (если `searchable`) либо сам listbox (`tabindex="-1"`).
- Активная опция трекается атрибутом `aria-activedescendant` на якоре.
- Выгода: ввод в поиск работает в любой момент без рефокуса; partial rerender не требует восстановления фокуса; стандартный ARIA-паттерн select+textbox.
- Формулировка «фокус получает первый option» всюду означает «активной становится первая опция»; DOM-фокус остаётся на якоре.

---

## 41. Focus management

- Открытие — по матрице §24.
- `ArrowDown` с search input → активность на первую selectable option.
- `Escape` → закрыть popover, вернуть фокус на toggle button. Escape из search input с непустым query закрывает popover сразу (без двухступенчатого «сначала очистить»).
- Single-mode выбор → закрыть popover, вернуть фокус на trigger.

---

## 42. Keyboard navigation списка

Поддержка: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `Enter`, `Space`, `Escape`.

Одноколоночный режим: `ArrowUp/Down` двигают active; `Left/Right` не меняют.

Многоколоночный: `Up/Down` внутри колонки; `Left/Right` между соседними колонками. За пределы списка навигация не выходит; wrap-around не используется. `Home` → первая, `End` → последняя опция. `Enter`/`Space` → select/deselect active. Disabled options пропускаются.

Геометрия навигации детерминирована фиксированной высотой опции (§6.6): строки сетки известны точно, group headers не являются позициями навигации.

---

## 43–45. Grid / Columns / Horizontal scrolling / Groups

`columns=1` — вертикальный список. `columns>1` — CSS Grid c `grid-auto-flow: column`; заполнение сверху вниз.

Число строк: `floor(availableHeight / optionHeight)`, где `availableHeight = modalMaxHeight − header − batch actions`. Если элементов больше, чем строк — создаются дополнительные физические колонки; viewport фиксированной ширины; overflow только по X; вертикальный scrolling списка не используется.

Горизонтальная прокрутка: `overflow-x: auto; overflow-y: hidden`. Вертикальное wheel движение браузер преобразует в горизонтальное, где доступно; touchpad-жесты работают нативно. ScrollLeft сохраняется при незначительном dynamic rerender.

Group header занимает одну layout-позицию, не focusable, пропускается навигацией. Группа без опций после фильтрации header не показывает.

---

## 46–49. PositionEngine

Работает с реальными DOM-геометриями. Сигнатура (уточнена, решение №12.1):

```js
calculate(triggerEl, popoverEl, { offset, maxHeight, margins })
```

Ядро математики выделено в **чистую функцию над плоскими rect-объектами** `{left, top, width, height}` — юнит-тесты без DOM; чтение `getBoundingClientRect()` — тонкая обёртка.

### Vertical

Первичный вариант — below trigger. Если `viewportHeight − triggerRect.bottom` достаточно для popover + offset → below; иначе above. Если недостаточно ни там, ни там — сторона с большим пространством, высота ограничивается доступным местом. Popover никогда не выходит за viewport по вертикали; `modalMaxHeight` — верхний предел.

### Horizontal

`left = triggerRect.left`; правый край за viewport → `left = viewportWidth − popoverWidth`; отрицательный left → `0`. Popover шире viewport → `width = viewportWidth − margins`.

### Reposition triggers

Пересчёт: при `open()`; после изменения содержимого; после геометрического `updateConfig()`; при `window.resize`; при ResizeObserver изменения trigger; при изменении intrinsic size popover'а. Скролл: единый throttled `requestAnimationFrame` — несколько событий в одном frame объединяются.

---

## 50–52. ProximityEngine

Расстояние до AABB: `dx = max(xMin − x, 0, x − xMax)`; `dy` аналогично; `distance = sqrt(dx² + dy²)`. Расстояния считаются отдельно до main module и popover; закрытие при `min(dMain, dPopover) > cursorDistanceThreshold`.

### Защитные правила (решение №10)

1. **Сброс координат при `open()`**: расстояния оцениваются только по движениям, произошедшим после открытия.
2. **`pointermove` c фильтром `pointerType === 'mouse'`** вместо `mousemove` — отсечение touch-синтетики.
3. **Вооружение (arming)**: proximity активен только после того, как курсор хотя бы раз за сессию открытия попал в область main module **или** popover. До первого входа курсора proximity полностью неактивен.
   - Открытие мышью: клик доказывает присутствие курсора → armed немедленно.
   - Открытие клавиатурой: не armed, пока курсор целенаправленно не войдёт в компонент; болтающаяся вдали мышь закрыть не может.
4. Гистерезис: после инициирования close request повторное приближение курсора не отменяет начавшуюся asynchronous close transition. Сценарий `150.1 → close; 149.9 → reopen; 150.2 → close` без действий пользователя невозможен.

Lifecycle: listener регистрируется только когда popover открыт; raw event лишь сохраняет координаты, расчёт — в RAF; listener удаляется сразу после закрытия.

ProximityEngine не вызывает `close()` напрямую — callback `onThresholdExceeded()`; решение принимает контроллер.

---

## 53–55. Click outside, экземпляры, Instance IDs

Click outside: `pointerdown` на document; если `event.composedPath()` не содержит main root и popover — `close()`. (`pointerdown`, не `click`: закрыть до последующей обработки.) Light-dismiss браузером не используется (manual popover).

Экземпляры полностью независимы: собственные state, IDs, popover, listeners, RAF state, active option. Допускается несколько одновременно открытых popover'ов; клик внутри A — outside-click для B.

Instance IDs: глобальный монотонный генератор `csel-1, csel-2, …`; из него строятся `csel-N-trigger`, `csel-N-popover`, `csel-N-option-…`. ID никогда не строятся из пользовательских `item.id`.

---

## 56–59. DomRenderer и rendering

DomRenderer только строит DOM из подготовленного состояния; не решает вопросы выбора, поиска, позиционирования, proximity, событий.

Rendering: `createElement`/`createTextNode`/`DocumentFragment`; bulk updates через fragment; никакого полного rebuild на каждый `mousemove`. Раздельно обновляются: selection view, search results, state blocks, active option, config-dependent controls.

Partial rendering: изменение selection обновляет только `aria-selected`, checkbox visual, tags, clear button, overflow state. Query — допустим полный rebuild listbox. Layout properties — перестройка соответствующей области.

Config-driven UI: наличие search/clear/select-all, columns, widths/heights/lines, animations, disabled/readonly/loading, search mode, proximity threshold. Детали реализации (RAF batching, lifecycle state, DOM update strategy, ARIA mechanics) конфигом не являются.

---

## 60. Анимации

`animations=true`: opacity + transform через `@starting-style` + `transition-behavior: allow-discrete`, совместимые с Popover lifecycle (гарантированы версиями §2.1). `animations=false`: никакие transition/animation классы не добавляются.

Обязателен учёт `@media (prefers-reduced-motion: reduce)`: декоративные анимации отключаются; `animations=true` никогда не заставляет пользователя ждать анимацию.

---

## 61–62. CSS isolation и тема

Все классы с префиксом `csel-` (`.csel-root`, `.csel-trigger`, `.csel-tag`, `.csel-popover`, `.csel-option`, `.csel-group`); переменные `--csel-*`. Shadow DOM не используется.

Единственная тема — dark:

```css
:root {
    --csel-bg-main: #18181b;
    --csel-bg-hover: #27272a;
    --csel-bg-modal: #121214;
    --csel-border: #3f3f46;
    --csel-border-focus: #6366f1;
    --csel-text: #f4f4f5;
    --csel-text-muted: #a1a1aa;
    --csel-accent: #6366f1;
    --csel-accent-hover: #4f46e5;
    --csel-tag-bg: #27272a;
    --csel-tag-border: #52525b;
    --csel-divider: #27272a;
    --csel-radius: 6px;
    --csel-transition: 0.15s ease-in-out;
}
```

Тема не является runtime config; переключения light/dark нет.

---

## 63–65. Public API

```js
class CustomSelect {
    constructor(target, config, events)

    async open()
    async close()
    async toggle()

    updateConfig(newConfig)

    setItems(items)
    setValue(ids)

    getValue()

    async clear()
    async selectAll()

    on(event, handler)      // новое, решение №7
    off(event, handler)     // новое, решение №7

    destroy()
}
```

Constructor: `target` — HTMLElement или selector string. Selector должен соответствовать ровно одному элементу: zero matches → `Error`; multiple matches → `Error`. Target не удаляется из DOM при `destroy()`; библиотека строит UI внутри него.

`disabled`/`readonly` ограничивают пользовательское взаимодействие, но не программное API (`select.updateConfig({disabled:true}); select.setValue([5]);` — разрешено).

---

## 66–69. Модули

**SearchEngine**: normalize, contains/startsWith/exact/fuzzy, AND/OR-семантика §31–35, keywords, filtering. Не изменяет state. API: `search(items, query, options)` → `CustomSelectItem[]` в исходном порядке. Может кэшировать normalized fields.

**KeyboardNav**: active item, стрелки, Home/End, Enter/Space, Escape, focus transitions, пропуск disabled, возврат фокуса. Selection не меняет сам — callback `onSelectIntent(id)`; мутацию выполняет CustomSelect/StateManager.

**PositionEngine**: не знает про selection/search/keyboard/events; принимает DOM elements и geometry options, возвращает geometry (ядро — чистая функция над rect, §46).

**ProximityEngine**: не вызывает `close()` — только `onThresholdExceeded()`.

---

## 71. Ошибки

Стандартные ошибки: `TypeError` — неправильные аргументы; `Error` — lifecycle misuse; `NotSupportedError`/`Error` — отсутствие Popover API. Текст ошибки конфигурации содержит имя поля: `Invalid CustomSelectConfig.columns: expected integer >= 1, got 0.` Полный пользовательский config и чувствительные данные в сообщениях не раскрываются.

---

## 72–73. Производительность

Целевая нагрузка ~100 items, жёсткий лимит не устанавливается.

Запрещены: полный DOM rerender на каждый `mousemove`; sync read/write layout циклы по каждому элементу; множественные forced reflow; повторная нормализация одних и тех же полей на каждый keypress (SearchEngine может предвычислять normalized fields). Измерительные проходы layout группируются.

Виртуализация **не реализуется** (усложнит keyboard nav и accessibility; не соответствует scope v1). Архитектура не содержит жёсткого лимита на количество items.

---

## 74. Вне scope первой версии

Интеграция с `<select>`, form submission, FormData, native validation, remote loading, pagination, virtual scroll, создание новых элементов пользователем, drag-and-drop reorder, plugin system, light theme, custom HTML renderer API, произвольная разметка опций, UMD/IIFE.

---

## 75–76. Отличия от исходного плана и границы роста

Дополнительно к исходному плану: readonly, exact mode, emptyListText, case sensitivity, NFKC, AND-поиск, highlighting, Home/End, focus management, ResizeObserver, resize/scroll repositioning, строгие duplicate IDs, строгий setValue, разделение loading/empty/no-results, Instance ID generator, partial rerender, prefers-reduced-motion, полноценный click-outside.

Проект сознательно не клон Tom Select / Choices: компактный специализированный компонент с предсказуемым API, нулевыми зависимостями, современным Popover API, качественной клавиатурой, multi-column UX, proximity auto-close, реактивной конфигурацией.

---

## 77. Файловая структура и тестирование (обновлено, решение №8)

```text
custom-select/
├── package.json
├── vite.config.js
├── tsconfig.json
├── index.html
│
├── src/
│   ├── index.js
│   ├── types.js
│   ├── styles/{variables,main-module,modal-module,animations,index}.css
│   └── core/
│       ├── CustomSelect.js      ├── EventEmitter.js
│       ├── ConfigManager.js     ├── StateManager.js
│       ├── DomRenderer.js       ├── PositionEngine.js
│       ├── ProximityEngine.js   ├── KeyboardNav.js
│       ├── SearchEngine.js      └── InstanceId.js
│
└── tests/
    ├── unit/                    ← Vitest (Node)
    │   ├── EventEmitter.test.js
    │   ├── ConfigManager.test.js
    │   ├── StateManager.test.js
    │   ├── SearchEngine.test.js
    │   ├── PositionEngine.test.js      (чистая математика над rect)
    │   └── ProximityEngine.test.js     (чистая математика над rect)
    └── integration/             ← Playwright (реальные Chromium/Firefox/WebKit)
        └── CustomSelect.integration.spec.js
```

jsdom/happy-dom не реализуют Popover API — интеграционные тесты выполняются только в реальном браузере. Юнит-слой покрывает чистую логику; PositionEngine/ProximityEngine спроектированы как чистые функции над `{left, top, width, height}` с тонкими DOM-обёртками.

---

## 78–95. Этапы реализации

Сохраняются этапы 1–18 исходного ТЗ (setup → types → InstanceID → EventEmitter → ConfigManager → StateManager → SearchEngine → базовый DomRenderer → Popover lifecycle → search/list rendering → PositionEngine → ProximityEngine → KeyboardNav → dynamic updates → multiple instances → CSS/animations → accessibility audit → demo) со следующими уточнениями:

- **Этап 1**: dev-зависимости включают Vitest и Playwright; `npm run test:unit`, `npm run test:e2e` входят в definition of done вместе с `npm run build` и `npm run typecheck`.
- **Этап 11**: ядро позиционирования сначала реализуется как чистая функция над rect + unit-тесты, затем DOM-обёртка и Playwright-проверки граничных случаев.
- **Этап 12**: тесты покрывают сценарии armed/unarmed proximity (клавиатурное открытие без входа курсора не закрывает).
- **Этап 14**: проверяется также делегирование `updateConfig({items})` / `updateConfig({selectedIds})`.
- Demo-сценарии (этап 18) — без изменений относительно исходного ТЗ.

---

## 96. Definition of Done

Проект завершён, если: build/typecheck/tests проходят без ошибок и warnings; runtime dependencies отсутствуют; duplicate item IDs обнаруживаются; invalid config обнаруживается; selection корректен в single/multiple (single всегда заменяет); disabled items нельзя выбрать мышью/клавиатурой; readonly не меняет state; loading блокирует изменение выбора и поиска; search работает во всех 4 режимах с OR×AND семантикой; image сохраняет пропорции; `img` без `alt`; accessible name у image-only опций; groups + search; select all — только по результатам поиска; clear all — полный; `popover="manual"`; не обрезается `overflow:hidden`; позиция сверху/снизу адаптивна; не выходит за viewport; reposition на resize/scroll; click outside; proximity с правилами arming; экземпляры не конфликтуют; keyboard navigation; возврат фокуса; Escape закрывает; dynamic config на открытом popover; setItems сохраняет selection; destroy полностью чистит; prefers-reduced-motion; callbacks awaited; ошибка callback не ломает состояние; публичные `on/off`; `aria-activedescendant` механика; фиксированная высота опций; single mode — текст+clear; переключение `multiple→false` оставляет первый выбранный.

---

## 97. Итоговая архитектурная модель

```text
                 ┌────────────────────┐
                 │    CustomSelect    │
                 │       Facade       │
                 └─────────┬──────────┘
                           │
       ┌───────────────────┼──────────────────────┐
       ▼                   ▼                      ▼
ConfigManager        StateManager          EventEmitter
       │                   │                      │
       └──────────────┬────┴──────────────┬──────┘
                      ▼                   ▼
                DomRenderer          KeyboardNav
                      │
             ┌────────┴────────┐
             ▼                 ▼
       Main Module         Popover
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
       SearchEngine      PositionEngine    ProximityEngine
```

Инвариант: State/Search/Position/Proximity не знают о чужих доменах; Renderer не принимает бизнес-решений; CustomSelect — orchestrator/facade.

---

## 98. Ключевые инварианты

1. Один `id` — максимум один item.
2. `selectedIds` содержит только существующие items.
3. Disabled item не выбирается пользовательским действием.
4. Readonly не изменяет selection пользовательскими средствами.
5. Single mode содержит максимум один selected ID; `select()` заменяет.
6. Popover state соответствует фактическому Popover state.
7. Destroyed instance не имеет активных listeners.
8. Экземпляры не изменяют state друг друга.
9. Renderer не меняет business state.
10. Пользовательские callbacks не ломают внутреннее состояние.
11. Пользовательский контент никогда не интерпретируется как HTML.
12. Popover не выходит за пределы viewport.
13. Active item — `null` или существующий enabled item.
14. Search не меняет исходный порядок items.
15. Dynamic config changes не требуют пересоздания instance.
16. Runtime зависимости отсутствуют.
17. Proximity неактивен до первого входа курсора в область компонента за сессию открытия.

---

## Приложение A. Реестр решений мозгового штурма

| # | Решение |
|---|---------|
| 1 | `select(id)` в single mode всегда заменяет выбор; ошибки при уже выбранном другом элементе нет |
| 2 | Матрица начального фокуса: стрелки с root ведут прямо в список, остальные способы — input-first |
| 3 | Активная опция через `aria-activedescendant`; якорь — search input или listbox |
| 4 | Минимальные браузеры подняты: Chrome 151+, Firefox 154+, Safari 26+; анимации через `@starting-style`/`allow-discrete` гарантированы |
| 5 | Single mode: выбранное значение — текст + clear; без тегов/remove-кнопок |
| 6 | Фиксированная высота опции из `lineHeight` + ellipsis; детерминированная сетка и навигация |
| 7 | Публичные `on(event, handler)` / `off(event, handler)` |
| 8 | Vitest для unit (математика над плоскими rect) + Playwright для интеграции |
| 9 | Поиск: OR по полям внутри токена, AND между токенами; fuzzy по токенам |
| 10 | Proximity: сброс координат при open; `pointermove` + `pointerType==='mouse'`; arming после первого входа курсора в компонент; гистерезис сохранён |
| 11 | `multiple: true→false`: остаётся первый выбранный, один `onChange` |
| 12 | Мелкая пачка: сигнатура `calculate(triggerEl, popoverEl, {offset, maxHeight, margins})`; search input при loading — disabled с сохранением query; min-width popover = ширина триггера; batch-кнопки при readonly/loading — disabled; fuzzy-highlight по позициям subsequence каждого токена; maxLines только multiple; Escape всегда закрывает |
| 13 | `updateConfig({items})` / `updateConfig({selectedIds})` делегируют пайплайнам `setItems`/`setValue`; неизвестные ID в конструкторе и `setValue` → Error |
