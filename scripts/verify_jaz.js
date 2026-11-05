#!/usr/bin/env node

/**
 * Проверяет JSON из stdin на соответствие стандарту JAZ.
 * Возвращает код 0, если соответствует, иначе выводит сообщение об ошибке в stderr и завершается с кодом 1.
 */

// Допустимые типы коллекций первого уровня
const VALID_COLLECTIONS = new Set(['code', 'cm', 'plan', 'schedule', 'task', 'value']);

/**
 * Формирует сообщение об ошибке с указанием пути и выбрасывает исключение.
 * @param {string[]} path - массив сегментов пути к ошибочному узлу
 * @param {string} message - текст ошибки
 */
function throwError(path, message) {
    const pathStr = path.length ? path.join('.') : 'root';
    throw new Error(`Validation error at ${pathStr}: ${message}`);
}

/**
 * Проверяет структуру элемента вычислительной модели (cm).
 * @param {any} elem - проверяемый элемент
 * @param {string[]} path - путь к элементу
 */
function validateCmElement(elem, path) {
    // Поле type
    if (!('type' in elem)) {
        throwError(path, 'Missing required field "type"');
    }
    if (typeof elem.type !== 'string') {
        throwError([...path, 'type'], 'Field "type" must be a string');
    }
    if (elem.type !== 'simple') {
        throwError([...path, 'type'], `Unsupported cm type "${elem.type}". Only "simple" is allowed.`);
    }

    // Поле names
    if (!('names' in elem)) {
        throwError(path, 'Missing required field "names"');
    }
    if (typeof elem.names !== 'object' || elem.names === null || Array.isArray(elem.names)) {
        throwError([...path, 'names'], 'Field "names" must be an object');
    }

    // Поле ops
    if (!('ops' in elem)) {
        throwError(path, 'Missing required field "ops"');
    }
    if (typeof elem.ops !== 'object' || elem.ops === null || Array.isArray(elem.ops)) {
        throwError([...path, 'ops'], 'Field "ops" must be an object');
    }

    // Проверка каждого оператора
    for (const opId of Object.keys(elem.ops)) {
        const op = elem.ops[opId];
        const opPath = [...path, 'ops', opId];

        if (typeof op !== 'object' || op === null || Array.isArray(op)) {
            throwError(opPath, 'Operator must be an object');
        }

        // type оператора
        if (!('type' in op)) {
            throwError(opPath, 'Missing required field "type"');
        }
        if (op.type !== 'simple') {
            throwError([...opPath, 'type'], `Unsupported operator type "${op.type}". Only "simple" is allowed.`);
        }

        // code
        if (!('code' in op)) {
            throwError(opPath, 'Missing required field "code"');
        }
        if (typeof op.code !== 'string') {
            throwError([...opPath, 'code'], 'Field "code" must be a string');
        }

        // args
        if (!('args' in op)) {
            throwError(opPath, 'Missing required field "args"');
        }
        if (!Array.isArray(op.args)) {
            throwError([...opPath, 'args'], 'Field "args" must be an array');
        }
        for (let i = 0; i < op.args.length; i++) {
            if (typeof op.args[i] !== 'string') {
                throwError([...opPath, 'args', i.toString()], 'Argument must be a string');
            }
        }
    }
}

/**
 * Рекурсивно проверяет корневой объект на соответствие JAZ.
 * @param {any} obj - проверяемый объект
 * @param {string[]} path - текущий путь (для рекурсии)
 */
function validateRoot(obj, path) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        throwError(path, 'Root must be a JSON object');
    }

    for (const key of Object.keys(obj)) {
        if (!VALID_COLLECTIONS.has(key)) {
            throwError([...path, key], `Unknown collection type. Allowed: ${Array.from(VALID_COLLECTIONS).join(', ')}`);
        }

        const collection = obj[key];
        if (typeof collection !== 'object' || collection === null || Array.isArray(collection)) {
            throwError([...path, key], 'Collection must be an object');
        }

        // Проверка каждого элемента в коллекции
        for (const elemId of Object.keys(collection)) {
            const elem = collection[elemId];
            if (typeof elem !== 'object' || elem === null || Array.isArray(elem)) {
                throwError([...path, key, elemId], 'Element must be an object');
            }

            // Для вычислительных моделей применяем углублённую проверку
            if (key === 'cm') {
                validateCmElement(elem, [...path, key, elemId]);
            }
            // Для остальных коллекций дополнительные проверки не требуются,
            // так как их внутренняя структура не специфицирована в предоставленных документах.
        }
    }
}

// Чтение stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
    try {
        const obj = JSON.parse(input);
        validateRoot(obj, []);
        process.exit(0);
    } catch (e) {
        if (e instanceof SyntaxError) {
            console.error('Invalid JSON:', e.message);
        } else {
            console.error(e.message);
        }
        process.exit(1);
    }
});
process.stdin.on('error', err => {
    console.error('Error reading stdin:', err);
    process.exit(1);
});
