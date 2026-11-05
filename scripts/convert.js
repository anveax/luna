#!/usr/bin/env node

const HELP_MSG = `\
Convert JSON from LuNA-6 to LuNA-7
Usage:
	cat file.ja | node convert.js > file.jaz`

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { abort, nimpl } = require("../src/common.js");

/*
function abort() {
	if (arguments.length > 0)
		console.error("[ERROR]", ...arguments);
	throw Error("ERROR");
}

function nimpl() {
	if (arguments.length > 0)
		console.error("[NIMPL]", ...arguments);
	throw Error("NIMPL");
}
*/

function to_int(expr) {
	assert(typeof expr === 'object');

	switch (expr.type) {
		case '+':
			if (expr.operands.length === 2)
				return to_int(expr.operands[0]) +
					to_int(expr.operands[1]);
			else nimpl(expr);
		case 'iconst':
			return expr.value;
		default:
			nimpl(expr);
	}
}

function list_to_ref(list) {
	assert(typeof list === 'object' && list.constructor.name === 'Array');
	assert(typeof list[0] === 'string');
	var tokens = list.map(expr => typeof expr === 'string'? expr:
		to_int(expr));
	return tokens.map(t => `${t}`).join(':');
}

function parse_import(sub) {
	// Convert 'import' ja construct into a 'code' jaz construct (partial):

	assert('external_id' in sub);

	var code = {
		type: 'codefrag',
		// format: unknown
		params: sub.params,
		code_id: sub.external_id
	};

	/*
	if (sub.format === 'cpf')
		code.c_func_name = sub.code;
	else {
		return null;
		code.path = sub.code;
	}
	*/

	return {
		name: sub.alias,
		code
	}
}

function eval_int(expr) {
	switch(expr.type) {
		case 'iconst':
			return expr.value;
		case '-':
			assert(expr.operands.length === 2);
			return eval_int(expr.operands[0]) - eval_int(expr.operands[1]);
		case '+':
			assert(expr.operands.length === 2);
			return eval_int(expr.operands[0]) + eval_int(expr.operands[1]);
		case '*':
			assert(expr.operands.length === 2);
			return eval_int(expr.operands[0]) * eval_int(expr.operands[1]);
		case '/':
			assert(expr.operands.length === 2);
			return eval_int(expr.operands[0]) / eval_int(expr.operands[1]);
		default:
			nimpl(expr);
	}
}

function try_collapse(expr) {
	assert(expr.type === 'id');
	assert(expr.ref.length === 2);
	return {
		type: 'id',
		ref: [ `${expr.ref[0]}:${eval_int(expr.ref[1])}` ]
	}
}

function add_oper(ops, bi, jaz) {
	if (bi.id.length !== 1)
		nimpl(bi.id);
	var bi_name = bi.id[0];

	assert(!(bi.id in ops));

	// ensure we have a code for that
	if (!(bi.code in jaz.code)) {
		abort("code not found", bi.code, bi, jaz.code);
	}
	//assert(bi.code in jaz.code);
	var sub = jaz.code[bi.code];

	var ins = [];
	var outs = [];
	code = `local://code/${bi.code}`;
	ops[bi.id] = {
		type: 'simple',
		code,
		args: []
	}

	if (bi.args.length !== sub.params.length)
		abort("args/params length missmatch", bi, sub);
	assert(bi.args.length === sub.params.length);

	// Convert arguments
	for (var i=0; i<bi.args.length; i++) {
		var arg = bi.args[i];
		if (arg.type === 'id' && arg.ref.length === 2) {
			arg = try_collapse(arg);
		}
		if (arg.type === 'iconst') {
			ops[bi.id].args.push(arg.value);
			assert(sub.params[i].kind === 'input');
		} else if (arg.type === 'sconst') {
			ops[bi.id].args.push({ type: 'string', value: arg.value} );
			assert(sub.params[i].kind === 'input');
		} else {

			if (arg.type !== 'id' || arg.ref.length !== 1)
				nimpl(arg);

			var ref = arg.ref[0];
			ops[bi.id].args.push(ref);
			switch (sub.params[i].kind) {
				case 'input':
					if (ins.indexOf(ref) === -1)
						ins.push(ref);
					break;
				case 'output':
					if (outs.indexOf(ref) === -1)
						outs.push(ref);
					break;
				default:
					nimpl(sub.params[i].kind);
			}
		}
	}
}

function parse_export(sub, jaz) {
	assert(sub.type === 'struct');

	var cm = {
		names: {}, // "x": {}
		ops: {} // "a": { inputs: ["x"...], outputs: ["y"...],
		// "code": "local://code/inc", "args": { n: ["x"] } }
		// "rules": [{"property": "name", "items": [...]}...]
	};

	function add_var(name) {
		assert(!(name in cm.names));
		cm.names[name] = {};
	}

	// Now parse body
	for (var bi of sub.body) {
		switch (bi.type) {
			case 'dfs':
				for (var name of bi.names)
					add_var(name);
				break;
			case 'exec':
				add_oper(cm.ops, bi, jaz);
				break;
			default:
				nimpl(bi);
		}
	}

	return cm;
}

function parse_iface(sub) {
	var task = {
		cm: `local://cm/${sub.sub}`,
		format: sub.format,
		params: []
	};

	for (var param of sub.params) {
		switch (param.kind) {
			case 'input':
				param.target = list_to_ref(param.target);
				break;
			case 'output':
				param.source = list_to_ref(param.source);
				break;
			default:
				nimpl(param);
		}
		if (sub.format === 'dclif') {
			assert('format' in param);
			param.name = param.format;
			delete param.format;
		}
		task.params.push(param);
	}

	return task;
}

function convert(ja) {
	// Algorithm:
	// Loop through subs and convert 'import' and 'export' subs
	// to code fragments and cms+tasks

	var jaz = {
		iface: {},
		cm: {},
		code: {},
	}

	// First parse imports and interfaces, then exports
	for (var sub_name in ja) {
		var sub = ja[sub_name];

		switch (sub.type) {
			case 'import':
				var parsed = parse_import(sub);
				if (parsed !== null) {
					assert(parsed.name);
					assert(!(parsed.name in jaz.code));
					jaz.code[parsed.name] = parsed.code;
				}
				break;
			case 'struct':
				continue;
			case 'iface':
				jaz.iface[sub_name] = parse_iface(sub);
				break;
			default:
				nimpl(ja[sub_name], sub_name, sub);
		}
	}

	for (var sub_name in ja) {
		var sub = ja[sub_name];

		switch (sub.type) {
			case 'import':
			case 'iface':
				continue;
			case 'struct': {
				var cm = parse_export(sub, jaz);
				jaz.cm[sub_name] = cm;
				break;
			}
			default:
				nimpl(ja[sub_name], sub_name);
		}
	}

	return jaz;
}

var ja = JSON.parse(fs.readFileSync(0, 'utf-8'));

console.log(JSON.stringify(convert(ja), null, 2));
