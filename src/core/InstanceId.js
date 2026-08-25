let counter = 0;

/** @returns {string} уникальный монотонный идентификатор экземпляра */
export function nextInstanceId() {
    counter += 1;
    return `csel-${counter}`;
}
