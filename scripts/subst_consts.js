#!/usr/bin/env node

// CLIF-stdio
// jaz -> jaz with consts moved to val

const assert = require('assert');
const fs = require('fs');

const { nimpl } = require("../src/common.js");

var jaz = JSON.parse(fs.readFileSync(0));

function is_integer(num) {
	assert(typeof num === 'number');
	var x;
	if (isNaN(num)) {
		return false;
	}
	x = parseFloat(num);
	return (x | 0) === x;
}

var consts = {};
if ('val' in jaz)
	consts = jaz.val;

var _next_string_const = 0;
function wrap_const(arg) {
	switch (typeof arg) {
		case 'string':
			return arg;
		case 'number':
			if (is_integer(arg)) {
				var key = '_int_const_' + arg;
				if (!(key in consts))
					consts[key] = {
						type: 'int32',
						value: parseInt(arg)
					}
				return `local://val/${key}`;
			} else
				nimpl(arg);
		case 'object':
			if (arg.type === 'string') {
				var key = `_string_const_${_next_string_const++}`;
				assert(!(key in consts));
				consts[key] = {
					type: 'string',
					value: arg.value
				};
				return `local://val/${key}`;
			} else
				nimpl(arg);
		default:
			nimpl(arg);
	}
}

for (var cmid in jaz.cm) {
	var cm = jaz.cm[cmid];

	for (var opid in cm.ops) {
		var op = cm.ops[opid];

		op.args = op.args.map(wrap_const);
	}
}

if (Object.keys(consts).length > 0) {
	jaz.val = consts;
}

console.log(JSON.stringify(jaz, null, 2));
