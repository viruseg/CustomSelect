# События

## Два способа подписки

**Через конструктор** (сокращённая форма):

```js
const select = new CustomSelect('#host', { items }, {
    onSelect: (item) => {},
    onDeselect: (item) => {},
    onChange: (items) => {},
    onOpen: () => {},
    onClose: () => {},
    onSearch: (query, matched) => {},
    onClear: () => {},
});
```

**Динамически** через публичные методы:

```js
const handler = (items) => console.log(items);
select.on('change', handler);
select.off('change', handler);
```

Имена событий: `'select'`, `'deselect'`, `'change'`, `'open'`, `'close'`, `'search'`, `'clear'`.

## Payload'ы

| Событие | Аргументы | Описание |
|---|---|---|
| `select` | `item: CustomSelectItem` | Выбран один элемент |
| `deselect` | `item: CustomSelectItem` | Снят выбор с одного элемента |
| `change` | `items: CustomSelectItem[]` | Итоговый выбор после любой мутации — в порядке выбора |
| `open` | — | Popover открылся |
| `close` | — | Popover закрылся |
| `search` | `query: string`, `matched: CustomSelectItem[]` | Изменился поисковый запрос; `matched` — текущие результаты |
| `clear` | — | Массовая очистка выбора |

## Порядок эмиссии

### Выбор элемента (single)

```text
мутация состояния → select(item) → change(items) → close() → close-событие
```

Popover закрывается после завершения обработчиков.

### Выбор/снятие (multiple)

```text
мутация → select(item) | deselect(item) → change(items)
```

Popover остаётся открытым.

### clear()

Одна массовая операция — **без** per-item `deselect`:

```text
очистка → clear() → change([])
```

### selectAll()

Тоже одна массовая операция:

```text
выбор → change(allSelected)
```

### setValue(ids)

Сравнение старого и нового состояний: для каждого изменившегося элемента — `deselect`/`select`, затем один `change`.

### setItems(newItems)

Для исчезнувших из списка выбранных элементов — по одному `deselect` + один `change`.

## Асинхронность и изоляция ошибок

Обработчики могут быть async и выполняются **строго последовательно** в порядке регистрации:

```js
select.on('save', async () => {
    await fetch('/api', { method: 'POST' }); // следующий обработчик ждёт этот
});
select.on('save', () => console.log('выполнится после fetch'));
```

Исключение в обработчике **не ломает компонент**:

- ошибка логируется в `console.error`;
- остальные обработчики продолжают выполняться;
- состояние библиотеки никогда не откатывается из-за ошибки колбэка;
- `emit` резолвится после завершения всех обработчиков.

```js
select.on('select', () => { throw new Error('упс'); });
select.on('select', () => console.log('всё равно выполнюсь')); // ✓
```

Повторная регистрация одного и того же обработчика на одно событие — no-op (Set-семантика).

## Пример: сохранение на сервер

```js
const select = new CustomSelect('#host', {
    items,
    multiple: true,
}, {
    onChange: async (items) => {
        await fetch('/api/user/tags', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(items.map(i => i.id)),
        });
    },
});
```

Пока выполняется запрос, UI уже обновлён (мутация происходит до эмиссии), а другие обработчики дождутся завершения `onChange`.
