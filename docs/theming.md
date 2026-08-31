# Темизация

Библиотека поставляется с единственной встроенной **тёмной темой**, построенной на CSS-переменных. Shadow DOM не используется — все классы и переменные снабжены префиксами, чтобы не конфликтовать с вашим приложением:

- классы: `csel-*`
- переменные: `--csel-*`

## Токены темы

Переопределяйте на любом уровне (`:root`, обёртка, конкретный инстанс):

```css
:root {
    --csel-bg-main: #18181b;        /* фон триггера */
    --csel-bg-hover: #27272a;       /* фон при наведении / активная опция */
    --csel-bg-modal: #121214;       /* фон popover */
    --csel-border: #3f3f46;         /* рамки */
    --csel-border-focus: #6366f1;   /* рамка фокуса */
    --csel-text: #f4f4f5;           /* основной текст */
    --csel-text-muted: #a1a1aa;     /* вторичный текст */
    --csel-accent: #6366f1;         /* акцент (выбранное, подсветка) */
    --csel-accent-hover: #4f46e5;   /* акцент при наведении */
    --csel-tag-bg: #27272a;         /* фон тега */
    --csel-tag-border: #52525b;     /* рамка тега */
    --csel-divider: #27272a;        /* разделители внутри popover */
    --csel-radius: 6px;             /* скругление */
    --csel-transition: 0.15s ease-in-out; /* базовая анимационная кривая */
}
```

Пример — светлая акцентная схема под бренд:

```css
:root {
    --csel-accent: #0ea5e9;
    --csel-accent-hover: #0284c7;
    --csel-border-focus: #0ea5e9;
}
```

## Runtime-переменные

Эти переменные выставляются библиотекой автоматически из конфига — менять руками обычно не нужно:

| Переменная | Откуда берётся |
|---|---|
| `--csel-line-height` | `lineHeight` |
| `--csel-main-width` | `mainWidth` |
| `--csel-max-lines` | `maxLines` |
| `--csel-columns` / `--csel-column-gap` | `columns` / `columnGap` |
| `--csel-modal-max-height` / `--csel-modal-width` | `modalMaxHeight` / `modalWidth` |
| `--csel-trigger-min-width` | ширина триггера (popover не уже триггера) |

## Структура DOM

```text
<div id="host">
└── .csel-root [role=group] [.csel-root--disabled|--readonly|--loading]
    ├── .csel-value-area
    │   ├── .csel-placeholder            ← показывается при пустом выборе
    │   ├── .csel-value-text            ← single: выбранное значение
    │   ├── .csel-tags                  ← multiple
    │   │   └── .csel-tag > .csel-tag-content + .csel-tag-remove[data-id]
    │   └── .csel-more                  ← кнопка «...»
    ├── .csel-uncheck                     ← кнопка ×
    └── .csel-toggle > svg.csel-chevron

<body>
└── .csel-popover[popover=manual][data-csel-anim]
    ├── .csel-search-header
    │   ├── .csel-search-icon
    │   ├── input.csel-search-input[type=search]
    │   └── .csel-search-clear
    ├── .csel-batch
    │   ├── .csel-check-all
    │   └── .csel-uncheck-all
    ├── .csel-listbox [role=listbox]
    │   ├── .csel-group-header
    │   └── .csel-option[--selected|--disabled|--active]
    │       ├── .csel-checkbox           ← только multiple, aria-hidden
    │       └── .csel-option-content
    │           ├── .csel-option-media > img.csel-img   ← image items
    │           └── .csel-option-label
    │           └── mark.csel-hl                        ← подсветка поиска
    └── .csel-status
        ├── .csel-spinner                ← loading
        └── .csel-empty                  ← empty-list / empty-search
```

## Состояния через модификаторы

| Класс | Когда |
|---|---|
| `.csel-root--disabled` | `disabled: true` |
| `.csel-root--readonly` | `readonly: true` (крестики удаления/очистки скрыты) |
| `.csel-root--loading` | `loading: true` |
| `.csel-option--selected` | Опция выбрана (красит чекбокс и текст) |
| `.csel-option--disabled` | Элемент данных `disabled` |
| `.csel-option--active` | Активна клавиатурой |

Пример кастомизации выбранной опции:

```css
.csel-option--selected {
    background: color-mix(in srgb, var(--csel-accent) 15%, transparent);
}
```

## Режимы списка и прокрутка

**Single column (`columns: 1`, по умолчанию)** — обычный вертикальный список. Если элементы не вмещаются в `modalMaxHeight`, список скроллится по вертикали; горизонтальной прокрутки нет.

**Multi column (`columns > 1`)** — CSS Grid с заполнением сверху вниз:

```css
.csel-listbox--grid {
    display: grid;
    grid-template-columns: repeat(var(--csel-columns), minmax(var(--csel-column-width, 160px), 1fr));
    grid-template-rows: repeat(N, var(--csel-line-height)); /* N считает библиотека */
    grid-auto-flow: column;
    grid-auto-columns: var(--csel-column-width, 160px);
    overflow-x: auto;
    overflow-y: hidden;
}
```

- Ширина колонки по умолчанию 160px — переопределите `--csel-column-width`.
- Вертикальной прокрутки нет: лишние элементы уходят в новые колонки вправо.
- Число строк сетки библиотека вычисляет из доступной высоты и выставляет сама (`grid-template-rows`) — без явных строк `grid-auto-flow: column` не переносит элементы вниз.
- Заголовки групп в многоколоночном режиме — обычные ячейки потока перед своей группой (span на всю ширину внутри column-flow ломает раскладку); в одноколоночном режиме они во всю ширину списка.

## Скроллбар

Скроллбар списка — тонкий (8px / `scrollbar-width: thin`) и раскрашенный токенами темы: ползунок `--csel-border`, при наведении `--csel-text-muted`, дорожка прозрачная. Кастомизация:

```css
.csel-listbox {
    scrollbar-color: var(--csel-accent) transparent; /* Firefox */
}
.csel-listbox::-webkit-scrollbar-thumb {
    background-color: var(--csel-accent);            /* Chromium/Safari */
}
```

## Дискретная прокрутка колонок (scroll-snap)

В многоколоночном режиме горизонтальная прокрутка не плавает пикселями, а «прилипает» к границам колонок:

```css
.csel-listbox--grid { scroll-snap-type: x mandatory; }
.csel-listbox--grid .csel-option { scroll-snap-align: start; }
.csel-listbox--grid .csel-group-header { scroll-snap-align: none; }
```

Все опции одной колонки имеют одинаковый x-offset, поэтому решётка привязки совпадает с границами колонок: каждое прокручивание завершается выровненной позицией. Заголовки групп (на всю ширину сетки) в привязке не участвуют. В одноколоночном режиме snap отключён — вертикальная прокрутка свободная.

## Изображения в опциях

Картинки сохраняют пропорции (`object-fit: contain`) и вписываются в бокс опции. Растянуть медиа-зону можно так:

```css
.csel-option-media { width: 32px; height: 32px; }
```

## Анимации

Появление popover — keyframes-анимация `csel-pop-in` (opacity + transform), включается только когда одновременно:

1. `animations: true` → на popover стоит `data-csel-anim="true"`;
2. системная настройка **не** `prefers-reduced-motion: reduce`.

Отключить глобально:

```js
new CustomSelect('#host', { animations: false });
```
