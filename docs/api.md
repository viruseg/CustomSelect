# Публичный API

## Конструктор

```js
new CustomSelect(target, config?, events?)
```


| Аргумент | Тип                 | Описание                                                                                                                                                                                                                                                                                                    |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`         | `HTMLElement | string` | Элемент-хост или CSS-селектор. Селектор должен соответствовать**ровно одному** элементу (0 → `Error`, >1 → `Error`). Библиотека строит UI внутри него; сам хост при `destroy()` не удаляется |
| `config`         | `CustomSelectConfig`   | Конфигурация, см.[configuration.md](configuration.md)                                                                                                                                                                                                                                                 |
| `events`         | `SelectEvents`         | Объект колбэков:`onSelect`, `onDeselect`, `onChange`, `onOpen`, `onClose`, `onSearch`, `onUncheckAll`                                                                                                                                                                                                      |

Бросает:

- `DOMException` (`NotSupportedError`) — браузер без HTML Popover API;
- `TypeError` — target не строка и не HTMLElement; неверные поля конфига; дубликаты id; несколько `selectedIds` в single mode;
- `Error` — селектор не нашёл/нашёл много элементов; неизвестные id в `selectedIds`.

Пример с событиями:

```js
const select = new CustomSelect('#host', { items }, {
    onSelect: (instance, item) => console.log(item.id),
    onChange: (instance, items) => saveToServer(items),
});
```

## Статические методы

### getInstance(node)

```js
const instance = CustomSelect.getInstance(domElement); // CustomSelect | null
```

Возвращает инстанс `CustomSelect`, привязанный к указанному DOM-элементу, или `null`, если:

- передан не `HTMLElement`;
- для данного элемента инстанс не был создан;
- инстанс уже уничтожен через `destroy()`.

```js
const host = document.querySelector('#my-select');
const select = CustomSelect.getInstance(host);
if (select) {
    await select.setValue([3]);
}
```

Используется для получения инстанса по DOM-узлу, например, внутри обработчиков событий или при работе с динамически создаваемыми компонентами.

### createInstance(target, config, events?)

```js
const select = await CustomSelect.createInstance('#host', { items });
```

Асинхронный хелпер: создаёт инстанс и ждёт, пока DOM гарантированно отрисован в родителе. После `await` элемент доступен через `querySelectorAll` и другие DOM-запросы.

| Аргумент | Тип                 | Описание |
| --- | --- | --- |
| `target` | `HTMLElement \| string` | Элемент-хост или CSS-селектор (как в конструкторе) |
| `config` | `CustomSelectConfig` | Конфигурация |
| `events` | `SelectEvents` | Объект колбэков (опционально) |

Возвращает `Promise<CustomSelect>`. Ошибки — те же, что и у конструктора.

Двойной `requestAnimationFrame` гарантирует, что браузер завершил layout перед возвратом:

```js
// DOM корня доступен сразу после await
const select = await CustomSelect.createInstance('#city', { items });
const root = document.querySelector('.csel-root'); // ← найдёт
```

Используйте вместо `new CustomSelect(...)` когда нужно убедиться, что DOM-дерево готово к запросам (например, при инициализации SSR-рендера или в тестах).

## Управление списком

### open() / close() / toggle()

```js
select.open();    // Promise<void> — открыть список
select.close();   // Promise<void> — закрыть
await select.toggle(); // открыть, если закрыт, и наоборот
```

- Все три возвращают `Promise` — переходы (`opening`→`open`→`closing`→`closed`) сериализуются: конфликтующие вызовы выстраиваются в очередь.
- Повторный `open()` при открытом списке — no-op (resolved promise).
- `open()` при `disabled: true` — no-op.

### Программное управление при disabled/readonly

`disabled` и `readonly` блокируют только **пользовательское взаимодействие**. Программный API работает всегда:

```js
select.updateConfig({ disabled: true });
await select.setValue([5]); // разрешено и выполнится
```

Это позволяет приложению вести собственную модель данных независимо от UI-блокировок.

## Работа с выбором

### getValue()

```js
const items = select.getValue(); // CustomSelectItem[] — синхронно
```

Возвращает выбранные элементы **в порядке выбора**. Это новый массив — мутации снаружи не затрагивают состояние.

### getItems()

```js
const allItems = select.getItems(); // CustomSelectItem[] — синхронно
```

Возвращает **глубокую копию** всех элементов списка. Мутации возвращённого массива или его элементов не влияют на внутреннее состояние компонента.

### getSelectedIds()

```js
const ids = select.getSelectedIds(); // (string|number)[] — синхронно
```

Возвращает массив **ID** выбранных элементов. Если ничего не выбрано — пустой массив `[]`. Удобнее `getValue()`, когда нужны только идентификаторы, а не полные объекты.

### setValue(ids)

```js
await select.setValue(['a', 'b']); // multiple
await select.setValue([42]);       // single
```

Строгая семантика:

- Неизвестный id → `Error` (до любой мутации).
- Больше одного id в single mode → `TypeError`.
- `disabled`-элементы программно устанавливать **можно** (запрет только для пользователя).

Для изменившихся элементов эмитятся `deselect`/`select`, затем один `change`.

### uncheckAll()

```js
await select.uncheckAll();
```

Полная очистка выбора. Одна массовая операция: эмитит `uncheckAll`, затем один `change` — без per-item `deselect`. Работает независимо от поискового запроса и readonly/disabled.

### checkAll()

```js
await select.checkAll();
```

Выбирает все **enabled**-элементы (только multiple; в single mode — no-op). Если popover открыт и есть активный запрос — выбирает **только текущие результаты поиска**: из 100 элементов при запросе «car» будут выбраны 12 найденных enabled. Эмитит один `change`.

## Данные

### setItems(items)

```js
await select.setItems(newItems);
```

Полная замена списка элементов:

1. новый массив полностью валидируется (дубликаты/невалидные → `TypeError`, состояние не трогается);
2. исчезнувшие id тихо снимаются с выбора (по `onDeselect` на каждый + один `onChange`);
3. сохранившиеся id остаются выбранными;
4. список перерисовывается, если был открыт.

### updateConfig(patch)

```js
await select.updateConfig({ columns: 3, searchMode: 'fuzzy' });
```

Реактивное применение конфигурации — см. [configuration.md#реактивность-updateconfig](configuration.md#реактивность-updateconfig). Внутри `{items}` и `{selectedIds}` делегируются в пайплайны `setItems`/`setValue`. Операция атомарна: невалидный патч не изменяет ничего.

## Пользовательские классы и атрибуты

### setClassName(className)

```js
select.setClassName('my-select custom-theme');
```

Устанавливает пользовательские CSS-классы на корневом элементе (`csel-root`). Классы аддитивные — добавляются к существующим. При повторном вызове старые пользовательские классы удаляются, новые добавляются.

### setAttributes(attributes)

```js
select.setAttributes({ 'data-testid': 'city-select', 'aria-label': 'Выбор города' });
```

Устанавливает пользовательские HTML-атрибуты на корневом элементе. Новые атрибуты добавляются, существующие перезаписываются. При повторном вызове пользовательские атрибуты удаляются (кроме служебных `role`, `tabindex`, `aria-disabled`).

Оба метода также доступны через `updateConfig()`:

```js
await select.updateConfig({ className: 'my-class', attributes: { 'data-id': 'x' } });
```

## Интеграция с оверлей-системами

### getPopover()

```js
const popoverEl = select.getPopover(); // HTMLElement
```

Возвращает DOM-элемент popover'а — выпадающий список, отрендеренный в `document.body`.

При первом вызове элемент создаётся лениво (вызов `open()` не требуется).

## Подписка на события

```js
select.on('change', handler);  // динамическая подписка
select.off('change', handler); // снятие
```

Первый аргумент обработчика — инстанс `CustomSelect`, вызвавший событие:

```js
select.on('change', (instance, items) => {
    console.log('Изменение в', instance, items);
});
```

Имена событий: `'select' | 'deselect' | 'change' | 'open' | 'close' | 'search' | 'uncheckAll'`. Полное описание — [events.md](events.md).

## destroy()

```js
select.destroy();
```

Закрывает popover, снимает все слушатели (включая document/window), отключает ResizeObserver, отменяет отложенные кадры анимации, удаляет весь свой DOM. Хост-элемент остаётся.

После `destroy()` любой метод кроме повторного `destroy()` бросает `Error`; повторный `destroy()` тоже бросает `Error`.

## Proximity-закрытие

Когда список открыт, библиотека следит за мышью: расстояние до триггера и popover считается по AABB. Если курсор отошёл дальше `cursorDistanceThreshold` от обоих — список закрывается.

Защитные правила (чтобы клавиатурные сценарии не ломались):

1. координаты курсора сбрасываются при каждом открытии;
2. учитываются только реальные движения мыши (`pointermove` c `pointerType === 'mouse'`);
3. **вооружение**: закрытие по расстоянию активируется только после того, как курсор хотя бы раз попал в область триггера или списка за текущую сессию открытия. Открыли клавиатурой, а мышь лежит вдали — случайное движение её не закроет.

Повторное приближение курсора не отменяет уже начавшееся закрытие (гистерезис).

## Классы ошибок


| Ошибка                            | Когда                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `DOMException(…, 'NotSupportedError')` | Нет HTML Popover API                                                                                                           |
| `TypeError`                             | Неверные аргументы, невалидный конфиг, дубликаты id, >1 id в single mode               |
| `Error`                                 | Lifecycle misuse (методы после destroy), неизвестные id, неоднозначный селектор target |
