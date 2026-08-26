# Конфигурация

Второй аргумент конструктора — объект `CustomSelectConfig`. Все поля кроме `items` опциональны. Неизвестные свойства игнорируются.

```js
new CustomSelect(target, config, events?)
```

## Полный список опций

### Данные и режим

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `items` | `CustomSelectItem[]` | `[]` | **Обязательное.** Массив элементов. Не мутируется библиотекой |
| `selectedIds` | `(string\|number)[]` | `[]` | Начальный выбор. В single mode допускается максимум один id; неизвестные id → `Error` |
| `multiple` | `boolean` | `false` | `true` — мультивыбор с тегами и чекбоксами; список не закрывается при выборе |

### Внешний вид основного модуля

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `placeholder` | `string` | `'Выберите значение...'` | Текст, когда ничего не выбрано |
| `maxLines` | `number` | `1` | Максимум строк тегов (только multiple). Переполнение скрывается за кнопкой «...» |
| `lineHeight` | `number` | `36` | Базовая высота строки в px: определяет высоту триггера, тегов **и каждой опции списка** (высота опции фиксирована, длинный текст обрезается `...`) |
| `mainWidth` | `number \| string` | `'100%'` | Ширина основного модуля |

### Popover

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `modalWidth` | `number \| string` | `'auto'` | Ширина popover. `'auto'` — по контенту, но не уже триггера |
| `modalMaxHeight` | `number` | `320` | Максимальная высота списка в px (реальный потолок — доступное место viewport) |
| `modalOffset` | `number` | `4` | Отступ между триггером и popover в px |

### Колонки

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `columns` | `number` | `1` | Количество колонок. При `>1` элементы заполняются сверху вниз; лишние колонки прокручиваются горизонтально |
| `columnGap` | `number` | `8` | Отступ между колонками в px |

### Поиск

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `searchable` | `boolean` | `true` | Показывать поле поиска |
| `searchMode` | `'contains' \| 'startsWith' \| 'exact' \| 'fuzzy'` | `'contains'` | Режим сопоставления (см. [search.md](search.md)) |
| `searchCaseSensitive` | `boolean` | `false` | Учитывать регистр (NFKC-нормализация применяется всегда) |
| `emptySearchText` | `string` | `'Ничего не найдено'` | Текст, когда запрос не дал результатов |
| `emptyListText` | `string` | `'Нет доступных элементов'` | Текст, когда items пуст или все disabled |

### Массовые действия

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `showClearAll` | `boolean` | `true` | Кнопка × очистки в триггере + «Снять всё» в popover (multiple). Видима только при непустом выборе |
| `showSelectAll` | `boolean` | `false` | Кнопка «Выбрать всё» (multiple). При активном поиске выбирает только найденные enabled-элементы |

### Состояния

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `disabled` | `boolean` | `false` | Полная блокировка взаимодействия. Открытый popover закрывается. Программный API продолжает работать |
| `readonly` | `boolean` | `false` | Можно открывать/искать/прокручивать, нельзя менять выбор. Batch-кнопки дизейблятся |
| `loading` | `boolean` | `false` | Вместо списка — спиннер; выбор и поиск заблокированы. Реагирует мгновенно даже на открытом popover |

### Поведение

| Опция | Тип | По умолчанию | Описание |
|---|---|---|---|
| `animations` | `boolean` | `true` | Анимация появления popover. Всегда отключается при системном `prefers-reduced-motion: reduce` |
| `cursorDistanceThreshold` | `number` | `150` | Порог proximity-закрытия в px: если курсор мыши отошёл от триггера и popover дальше этого расстояния — список закрывается. Правило вооружения см. [api.md](api.md#proximity-закрытие) |
| `showSelectedItems` | `boolean` | `true` | `false` — скрывать уже выбранные элементы из результатов поиска |
| `highlightSearchMatches` | `boolean` | `false` | Подсвечивать совпадения в тексте опций (`<mark class="csel-hl">`) |

## Валидация

Ошибки конфигурации бросаются из конструктора и `updateConfig()` **до** изменения состояния:

- Числовые поля проверяют нижнюю границу: `columns ≥ 1`, `maxLines ≥ 1`, `lineHeight ≥ 1`, `modalMaxHeight ≥ 1`, `modalOffset ≥ 0`, `columnGap ≥ 0`, `cursorDistanceThreshold ≥ 0`. `NaN` и `Infinity` запрещены.
- Сообщение содержит имя поля: `Invalid CustomSelectConfig.columns: expected number >= 1, got 0`.
- Duplicate `id` в `items`, неверный `type`, несколько `selectedIds` при `multiple=false` → `TypeError`.

## Реактивность: updateConfig()

`updateConfig(patch)` принимает подмножество опций и применяет их к живому компоненту — **в том числе при открытом popover**:

```js
await select.updateConfig({ columns: 3, loading: false });
```

Немедленно применяются: `columns`, `modalWidth`, `modalMaxHeight`, `columnGap`, `searchable`, `maxLines`, `lineHeight`, `placeholder`, `showClearAll`, `showSelectAll`, `disabled`, `readonly`, `loading`, а также все поисковые настройки.

Гарантии при открытом списке:

- текущий выбор сохраняется;
- поисковый запрос сохраняется (если search остаётся включён);
- позиция пересчитывается;
- активная клавиатурой опция сохраняется, если она ещё существует;
- фокус не теряется;
- popover не закрывается (кроме случая `disabled: true`);

Особые случаи:

- `updateConfig({ items })` работает идентично [`setItems()`](api.md#setitemsitems);
- `updateConfig({ selectedIds })` работает идентично [`setValue(ids)`](api.md#setvalueids);
- переключение `multiple: true → false`: из выбранных остаётся первый (по порядку выбора), остальные снимаются с событиями `deselect` + один `change`;
- `disabled: true` немедленно закрывает открытый popover.
