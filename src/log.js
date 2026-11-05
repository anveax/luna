// NOTE: set 'enabled' to true to enable logging
const assert = require('assert');
const path = require('path');

var enabled = false;

function getCallerInfo(offset = 0) {
    const original = Error.prepareStackTrace;
    Error.prepareStackTrace = (err, stack) => stack;
    const err = new Error();
    Error.captureStackTrace(err, getCallerInfo);
    const stack = err.stack;
    Error.prepareStackTrace = original;

    const callsite = stack[offset];
    if (!callsite) return { file: 'unknown', line: '0' };
    return {
        file: callsite.getFileName() || 'unknown',
        line: callsite.getLineNumber() || '0'
    };
}

function getPrefix(offset) {
    const { file, line } = getCallerInfo(offset + 1); // +1 пропускает сам getPrefix
    const filePath = file !== 'unknown' ? path.relative(process.cwd(), file) : file;
    return `${filePath}:${line}:`;
}

function log() {
	if (!enabled)
		return;
    const prefix = getPrefix(1);
    console.log(prefix, ...arguments);
}

function log_full() {
	if (!enabled)
		return;
	log(...arguments);
	console.log(new Error().stack());
}

function log_enable(flag) {
	assert(typeof flag === 'boolean');
	enabled = flag;
}

module.exports = {
	log,
	log_full,
	log_enable // NOTE: set enable to true to enable logging
};
