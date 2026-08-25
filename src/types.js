/**
 * @typedef {'text' | 'image'} ItemContentType
 */

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

/**
 * @typedef {Object} SimpleRect
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} PlacementResult
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 * @property {boolean} below
 */

/** @typedef {{name: string|null, items: import('./types.js').CustomSelectItem[]}} ItemGroup */

export {};
