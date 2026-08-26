/**
 * Тип содержимого опции: текст или картинка.
 *
 * @typedef {'text' | 'image'} ItemContentType
 */

/**
 * Режим сопоставления поискового запроса с названиями опций:
 * - `'contains'` — подстрока;
 * - `'startsWith'` — начало строки;
 * - `'exact'` — точное совпадение;
 * - `'fuzzy'` — нечёткий поиск.
 *
 * @typedef {'contains' | 'startsWith' | 'exact' | 'fuzzy'} SearchMode
 */

/**
 * Фаза жизненного цикла popover.
 *
 * @typedef {'closed' | 'opening' | 'open' | 'closing' | 'destroyed'} OpenState
 */

/**
 * Элемент списка выбора.
 *
 * Описывает одну опцию селекта: её идентификатор, содержимое
 * и поведение при выборе и поиске. Элементы передаются в конфигурации
 * как часть массива `items`.
 */
export class CustomSelectItem {
    /**
     * Уникальный идентификатор опции. Дубликаты запрещены
     * (TypeError из конструктора и setItems).
     * @type {string|number}
     */
    id;

    /**
     * Тип содержимого опции.
     * @type {ItemContentType}
     */
    type;

    /**
     * Текст опции для `type: 'text'` либо URL картинки для `type: 'image'`.
     * HTML не интерпретируется — только безопасные текстовые узлы.
     * @type {string}
     */
    content;

    /**
     * Дополнительные ключевые слова, по которым опция находится поиском.
     * @type {string[]|undefined}
     */
    searchKeywords;

    /**
     * Опция недоступна для выбора: пропускается клавиатурной навигацией
     * и исключается из поиска.
     * @type {boolean|undefined}
     */
    disabled;

    /**
     * Название группы для визуальной группировки опций.
     * @type {string|undefined}
     */
    group;

    /**
     * Доступное имя для скринридеров; перекрывает `content`
     * в ARIA-атрибутах.
     * @type {string|undefined}
     */
    ariaLabel;

    /**
     * Создаёт элемент списка выбора. На практике элементы задают
     * обычными объектами в массиве `items`, без `new`.
     *
     * @param {Object} p
     * @param {string|number} p.id - Уникальный идентификатор опции.
     * @param {ItemContentType} p.type - Тип содержимого опции.
     * @param {string} p.content - Текст опции или URL картинки.
     */
    constructor(p) {
        this.id = p.id;
        this.type = p.type;
        this.content = p.content;
    }
}

/**
 * Конфигурация CustomSelect — второй аргумент конструктора
 * `new CustomSelect(target, config)`.
 *
 * Все поля кроме `items` опциональны; неизвестные свойства игнорируются.
 * Значения по умолчанию зафиксированы в `ConfigManager.DEFAULT_CONFIG`.
 */
export class CustomSelectConfig {
    /**
     * Обязательный массив элементов списка; библиотека его не мутирует.
     * @type {CustomSelectItem[]}
     */
    items;

    /**
     * Начальный выбор. В single mode допускается максимум один id,
     * неизвестный id бросает Error.
     * По умолчанию `[]`.
     * @type {(string|number)[]|undefined}
     */
    selectedIds;

    /**
     * Мультивыбор с тегами и чекбоксами; список не закрывается при выборе.
     * По умолчанию `false`.
     * @type {boolean|undefined}
     */
    multiple;

    /**
     * Текст в триггере, когда ничего не выбрано.
     * По умолчанию `'Select a value...'`.
     * @type {string|undefined}
     */
    placeholder;

    /**
     * Максимум строк тегов (только multiple); переполнение скрывается
     * за кнопкой «…». Должно быть >= 1.
     * По умолчанию `1`.
     * @type {number|undefined}
     */
    maxLines;

    /**
     * Базовая высота строки в px: определяет высоту триггера, тегов
     * и каждой опции списка (длинный текст опций обрезается многоточием).
     * Должно быть >= 1.
     * По умолчанию `36`.
     * @type {number|undefined}
     */
    lineHeight;

    /**
     * Ширина основного модуля в px (число) или любая CSS-ширина (строка,
     * например `'100%'`). Ширина постоянна и не меняется при выборе пункта.
     * По умолчанию `150`.
     * @type {number|string|undefined}
     */
    mainWidth;

    /**
     * Ширина popover в px или CSS-ширина; `'auto'` — по контенту,
     * но не уже триггера.
     * По умолчанию `'auto'`.
     * @type {number|string|undefined}
     */
    modalWidth;

    /**
     * Максимальная высота списка в px (реальный потолок — доступное место
     * viewport). Должно быть >= 1.
     * По умолчанию `320`.
     * @type {number|undefined}
     */
    modalMaxHeight;

    /**
     * Отступ между триггером и popover в px. Должно быть >= 0.
     * По умолчанию `4`.
     * @type {number|undefined}
     */
    modalOffset;

    /**
     * Количество колонок: `1` — вертикальный список со скроллом; больше 1 —
     * заполнение сверху вниз с горизонтальным скроллом. Должно быть >= 1.
     * По умолчанию `1`.
     * @type {number|undefined}
     */
    columns;

    /**
     * Отступ между колонками в px. Должно быть >= 0.
     * По умолчанию `8`.
     * @type {number|undefined}
     */
    columnGap;

    /**
     * Показывать поле поиска.
     * По умолчанию `true`.
     * @type {boolean|undefined}
     */
    searchable;

    /**
     * Режим сопоставления запроса и названий опций.
     * По умолчанию `'contains'`.
     * @type {SearchMode|undefined}
     */
    searchMode;

    /**
     * Учитывать регистр при поиске (NFKC-нормализация применяется всегда).
     * По умолчанию `false`.
     * @type {boolean|undefined}
     */
    searchCaseSensitive;

    /**
     * Текст, когда запрос не дал результатов.
     * По умолчанию `'No matches found'`.
     * @type {string|undefined}
     */
    emptySearchText;

    /**
     * Текст, когда items пуст или все опции disabled.
     * По умолчанию `'No items available'`.
     * @type {string|undefined}
     */
    emptyListText;

    /**
     * Кнопка очистки «×» в триггере и «Clear all» в popover
     * (только multiple; видима при непустом выборе).
     * По умолчанию `true`.
     * @type {boolean|undefined}
     */
    showClearAll;

    /**
     * Кнопка «Select all» (multiple); при активном поиске выбирает только
     * найденные enabled-элементы.
     * По умолчанию `false`.
     * @type {boolean|undefined}
     */
    showSelectAll;

    /**
     * Полная блокировка взаимодействия; открытый popover закрывается,
     * программный API продолжает работать.
     * По умолчанию `false`.
     * @type {boolean|undefined}
     */
    disabled;

    /**
     * Можно открывать, искать и прокручивать список, но нельзя менять выбор;
     * batch-кнопки дизейблятся.
     * По умолчанию `false`.
     * @type {boolean|undefined}
     */
    readonly;

    /**
     * Вместо списка показывается спиннер; выбор и поиск заблокированы,
     * реагирует мгновенно даже на открытом popover.
     * По умолчанию `false`.
     * @type {boolean|undefined}
     */
    loading;

    /**
     * Анимация появления popover; всегда отключается при системном
     * `prefers-reduced-motion: reduce`.
     * По умолчанию `true`.
     * @type {boolean|undefined}
     */
    animations;

    /**
     * Порог proximity-закрытия в px: если курсор отошёл от триггера,
     * а popover дальше этого расстояния — список закрывается.
     * Должно быть >= 0.
     * По умолчанию `150`.
     * @type {number|undefined}
     */
    cursorDistanceThreshold;

    /**
     * Скрывать уже выбранные элементы из списка и результатов поиска.
     * По умолчанию `true`.
     * @type {boolean|undefined}
     */
    showSelectedItems;

    /**
     * Подсвечивать совпадения запроса в тексте опций (`mark.csel-hl`).
     * По умолчанию `false`.
     * @type {boolean|undefined}
     */
    highlightSearchMatches;

    /**
     * Пользовательские CSS-классы для корневого элемента (root).
     * Добавляются к существующему `csel-root` через `classList.add()`.
     * При обновлении старые пользовательские классы удаляются, новые добавляются.
     * По умолчанию `''`.
     * @type {string|undefined}
     */
    className;

    /**
     * Пользовательские HTML-атрибуты для корневого элемента (root).
     * Мёржатся с существующими: новые добавляются, существующие перезаписываются.
     * При обновлении旧 пользовательские атрибуты удаляются (служебные `role`,
     * `tabindex`, `aria-disabled` не затрагиваются).
     * По умолчанию `{}`.
     * @type {Record<string, string>|undefined}
     */
    attributes;

    /**
     * Создаёт объект конфигурации. На практике конфигурацию передают
     * обычным объектом вторым аргументом `new CustomSelect(...)`,
     * без `new`: обязательным является только `items`, остальные поля
     * берутся из значений по умолчанию.
     *
     * @param {Object} p
     * @param {CustomSelectItem[]} p.items - Массив элементов списка.
     */
    constructor(p) {
        this.items = p.items;
    }
}

/**
 * Колбэки событий — третий аргумент конструктора
 * `new CustomSelect(target, config, events)`.
 *
 * Все обработчики опциональны; каждому событию соответствует
 * своё свойство.
 */
export class SelectEvents {
    /**
     * Вызывается при выборе опции.
     * @type {((item: CustomSelectItem) => Promise<void> | void)|undefined}
     */
    onSelect;

    /**
     * Вызывается при снятии выбора с опции.
     * @type {((item: CustomSelectItem) => Promise<void> | void)|undefined}
     */
    onDeselect;

    /**
     * Вызывается при любом изменении набора выбранных опций.
     * @type {((items: CustomSelectItem[]) => Promise<void> | void)|undefined}
     */
    onChange;

    /**
     * Вызывается после открытия списка.
     * @type {(() => Promise<void> | void)|undefined}
     */
    onOpen;

    /**
     * Вызывается после закрытия списка.
     * @type {(() => Promise<void> | void)|undefined}
     */
    onClose;

    /**
     * Вызывается на каждый ввод в поле поиска: `query` — текущий запрос,
     * `matched` — найденные опции.
     * @type {((query: string, matched: CustomSelectItem[]) => Promise<void> | void)|undefined}
     */
    onSearch;

    /**
     * Вызывается при полной очистке выбора кнопкой «Clear all».
     * @type {(() => Promise<void> | void)|undefined}
     */
    onClear;
}

/**
 * Полное внутреннее состояние компонента.
 *
 * Формируется самой библиотекой и наружу не создаётся; полезно
 * при отладке и в тестах как описание структуры состояния.
 */
export class InternalState {
    /**
     * Текущий массив элементов.
     * @type {CustomSelectItem[]}
     */
    items;

    /**
     * Идентификаторы выбранных опций.
     * @type {Set<string|number>}
     */
    selectedIds;

    /**
     * Текущий поисковый запрос.
     * @type {string}
     */
    query;

    /**
     * Фаза жизненного цикла popover.
     * @type {OpenState}
     */
    openState;

    /**
     * Id активной (подсвеченной клавиатурой) опции или `null`.
     * @type {string|number|null}
     */
    activeId;

    /**
     * Компонент полностью заблокирован.
     * @type {boolean}
     */
    disabled;

    /**
     * Выбор заблокирован, просмотр разрешён.
     * @type {boolean}
     */
    readonly;

    /**
     * Идёт загрузка данных.
     * @type {boolean}
     */
    loading;

    /**
     * Создаёт снимок внутреннего состояния компонента.
     * Библиотека формирует его сама; вручную вызывать не нужно.
     *
     * @param {Object} p
     * @param {CustomSelectItem[]} p.items - Текущий массив элементов.
     * @param {Set<string|number>} p.selectedIds - Идентификаторы выбранных опций.
     * @param {string} p.query - Текущий поисковый запрос.
     * @param {OpenState} p.openState - Фаза жизненного цикла popover.
     * @param {string|number|null} p.activeId - Id активной опции или `null`.
     * @param {boolean} p.disabled - Компонент полностью заблокирован.
     * @param {boolean} p.readonly - Выбор заблокирован, просмотр разрешён.
     * @param {boolean} p.loading - Идёт загрузка данных.
     */
    constructor(p) {
        this.items = p.items;
        this.selectedIds = p.selectedIds;
        this.query = p.query;
        this.openState = p.openState;
        this.activeId = p.activeId;
        this.disabled = p.disabled;
        this.readonly = p.readonly;
        this.loading = p.loading;
    }
}

/**
 * Прямоугольник в координатах viewport.
 *
 * Используется движком позиционирования для расчёта раскладки popover.
 */
export class SimpleRect {
    /**
     * X левого края.
     * @type {number}
     */
    left;

    /**
     * Y верхнего края.
     * @type {number}
     */
    top;

    /**
     * Ширина.
     * @type {number}
     */
    width;

    /**
     * Высота.
     * @type {number}
     */
    height;

    /**
     * Создаёт прямоугольник из координат и размеров.
     *
     * @param {Object} p
     * @param {number} p.left - X левого края.
     * @param {number} p.top - Y верхнего края.
     * @param {number} p.width - Ширина.
     * @param {number} p.height - Высота.
     */
    constructor(p) {
        this.left = p.left;
        this.top = p.top;
        this.width = p.width;
        this.height = p.height;
    }
}

/**
 * Точка в координатах viewport.
 *
 * Используется движком позиционирования и proximity-логикой.
 */
export class Point {
    /**
     * Координата X.
     * @type {number}
     */
    x;

    /**
     * Координата Y.
     * @type {number}
     */
    y;

    /**
     * Создаёт точку из координат.
     *
     * @param {Object} p
     * @param {number} p.x - Координата X.
     * @param {number} p.y - Координата Y.
     */
    constructor(p) {
        this.x = p.x;
        this.y = p.y;
    }
}

/**
 * Итог позиционирования popover: прямоугольник размещения и сторона
 * относительно триггера.
 */
export class PlacementResult {
    /**
     * X левого края popover.
     * @type {number}
     */
    left;

    /**
     * Y верхнего края popover.
     * @type {number}
     */
    top;

    /**
     * Ширина popover.
     * @type {number}
     */
    width;

    /**
     * Высота popover.
     * @type {number}
     */
    height;

    /**
     * Popover размещён под триггером (`false` — над ним).
     * @type {boolean}
     */
    below;

    /**
     * Создаёт результат позиционирования.
     *
     * @param {Object} p
     * @param {number} p.left - X левого края popover.
     * @param {number} p.top - Y верхнего края popover.
     * @param {number} p.width - Ширина popover.
     * @param {number} p.height - Высота popover.
     * @param {boolean} p.below - Размещён ли popover под триггером.
     */
    constructor(p) {
        this.left = p.left;
        this.top = p.top;
        this.width = p.width;
        this.height = p.height;
        this.below = p.below;
    }
}

/**
 * Группа опций для визуальной группировки списка.
 *
 * Возникает, когда элементам задано поле `group`; опции без группы
 * попадают в группу с именем `null`.
 */
export class ItemGroup {
    /**
     * Название группы или `null` для опций без группы.
     * @type {string|null}
     */
    name;

    /**
     * Опции, входящие в группу.
     * @type {CustomSelectItem[]}
     */
    items;

    /**
     * Создаёт группу опций.
     *
     * @param {Object} p
     * @param {string|null} p.name - Название группы или `null`.
     * @param {CustomSelectItem[]} p.items - Опции, входящие в группу.
     */
    constructor(p) {
        this.name = p.name;
        this.items = p.items;
    }
}
