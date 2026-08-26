# Быстрый старт

## Требования

- **Браузеры:** Chrome 151+, Firefox 154+, Safari 26+. Библиотека использует HTML Popover API без полифиллов — при его отсутствии конструктор бросит `DOMException` с именем `NotSupportedError`.
- **Модули:** только ES Modules. Подключение через `<script type="module">`, сборщик (Vite/webpack/rollup) или importmap.
- **Node.js** (для установки и сборки): >= 22.

## Установка

Пакет распространяется как ESM-модуль. Пока он не опубликован в npm, установите его напрямую:

```bash
# из локального пути
npm install ../path/to/custom-select

# из git
npm install git+https://example.com/user/custom-select.git
```

Точки входа пакета:

| Импорт | Что даёт |
|---|---|
| `custom-select` | Класс `CustomSelect` (default) + `VERSION` (named) |
| `custom-select/index.css` | Все стили библиотеки |

## Минимальный пример

```html
<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>CustomSelect</title>
</head>
<body>
    <!-- Библиотека строит свой UI ВНУТРИ этого элемента -->
    <div id="city"></div>

    <script type="module">
        import CustomSelect from 'custom-select';
        import 'custom-select/index.css';

        const select = new CustomSelect('#city', {
            items: [
                { id: 'msk', type: 'text', content: 'Москва' },
                { id: 'spb', type: 'text', content: 'Санкт-Петербург' },
                { id: 'kzn', type: 'text', content: 'Казань' },
            ],
        });
    </script>
</body>
</html>
```

Без сборщика то же самое через importmap:

```html
<script type="importmap">
{
    "imports": {
        "custom-select": "/node_modules/custom-select/dist/index.js",
        "custom-select/index.css": "/node_modules/custom-select/dist/index.css"
    }
}
</script>
```

## Как устроен компонент

Библиотека **не использует** нативный `<select>`. Вы передаёте массив элементов — библиотека сама создаёт весь DOM и управляет состоянием.

**Основной модуль** строится внутри вашего элемента:

```text
<div class="csel-root" role="group">      ← клик открывает список
    ├── значение (текст) или теги          ← multiple mode
    ├── кнопка «...»                       ← если теги не поместились
    ├── кнопка ×                           ← очистка (showClearAll)
    └── кнопка-шеврон                      ← toggle
</div>
```

**Popover со списком** монтируется напрямую в `<body>` (поэтому не обрезается `overflow:hidden` родителей):

```text
<div popover="manual" class="csel-popover">
    ├── поиск                              ← searchable=true
    ├── «Выбрать всё» / «Снять всё»         ← batch actions
    └── listbox с опциями и группами
</div>
```

## Формат элемента данных

```js
{
    id: 'unique-id',          // string | number; 1 и "1" — разные id!
    type: 'text',             // 'text' | 'image'
    content: 'Название',      // текст опции ИЛИ URL картинки для type:'image'
    searchKeywords: ['синоним'], // доп. поля для поиска (опционально)
    disabled: false,          // запрет выбора пользователем (опционально)
    group: 'Название группы', // визуальная группировка (опционально)
    ariaLabel: 'Для скринридеров', // доступное имя (опционально)
}
```

HTML в `content` никогда не интерпретируется — только безопасные текстовые узлы.

## Что дальше

- [Конфигурация](configuration.md) — все опции
- [API](api.md) — методы и ошибки
- [Примеры](examples.md) — готовые рецепты
