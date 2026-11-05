#!/usr/bin/env node

// TODO check count of arguments

const assert = require('assert');

const { nimpl, traverse } = require("./common.js");
const { BASIC_TYPES } = require("./types.js");

function param_to_signature(param) {
	var param_type = param.type;
	if (param.type in BASIC_TYPES) {
		var res = BASIC_TYPES[param.type] + ' ';

		if (param.kind === 'output')
			res = res + '*';

		if (param.name)
			res = res + param.name;

		return res.trim();
	} else if (param.type.endsWith('[]')) {
		var type;
		type = param.type.substr(0, param.type.length-2);

		if (!(type in BASIC_TYPES))
			nimpl(param);

		var res = BASIC_TYPES[type] + ' *';
		if (param.kind === 'output') 
			res += '*';
		if (param.name)
			res += param.name;
		res += ', size_t';
		if (param.kind === 'output')
			res += ' *';
		if (param.name) {
			if (!res.endsWith('*'))
				res += ' ';
			res += param.name + '_size';
			return res;
		}
		return res;
	} else
		nimpl(param);
}
function gen_signature(code) {
	var params = code.params.map(param_to_signature);

	return `void ${code.code_spec}(${params.join(', ')});`;
}

function gen_invoke(jaz, schema, op, heads, body) {
	// find operation in jaz
	var plan = traverse(jaz, schema.plan);
	var task = traverse(jaz, plan.task);
	var cm = traverse(jaz, task.cm);

	var oper = cm.ops[op.operation];
	var code = traverse(jaz, oper.code);

	if (code.type === 'c_func_simple') {
		if (!(code.code_spec in heads)) {
			if ('listing' in code)
				heads[code.code_spec] = code.listing;
			else
				heads[code.code_spec] = gen_signature(code);
		}
		return gen_invoke_c_func_simple(code, op, oper, body);
	} else
		nimpl(code.type);
}

function gen_invoke_c_func_simple(code, op, oper, body) {
	var snippet = `// invoke operation ${op.operation}\n`;

	snippet += `${code.code_spec}(`;

	let args = [];

	let param_to_var = oper.args;
	let var_to_cvar = op.cvars;

	for (var i=0; i<code.params.length; i++) {
		var param = code.params[i];
		var cvar = op.args[i];

		if (param.kind === 'input') {
			if (typeof cvar === 'string') {
				args.push(cvar);
			} else if (typeof cvar === 'number') {
				args.push(cvar); // iconst
			} else {
				args.push(cvar.cvar);
				args.push(cvar.size_cvar);
			}
		} else if (param.kind === 'output') {
			if (typeof cvar === 'string') {
				args.push('&' + cvar);
			} else {
				args.push('&' + cvar.cvar);
				args.push('&' + cvar.size_cvar);
			}
		}
	}

	snippet += args.join(', ');
	snippet += ');\n';

	snippet.split('\n').forEach(ln => body.push(ln));

	return snippet;
}

function generate(jaz, schema) {
	let body = [];

	for(var cvarname in schema.cvars) {
		var cvar = schema.cvars[cvarname];
		body.push(`${cvar.ctype} ${cvarname}; // ${cvar.var}`);
	}
	for (var carrname in schema.carrs) {
		var carr = schema.carrs[carrname];
		body.push(`${carr.ctype} *${carrname}; // ${carr.var}`);
		body.push(`size_t ${carr.size_cvar}; // ${carr.var} size`);
	}

	var heads = {};

	for (var op of schema.opers) {
		if (op.type === 'read_stdin_int') {
			body.push(`${op.cvar} = cli_simple_read_int(${op.idx});`);
		} else if (op.type === 'read_stdin_float') {
			body.push(`${op.cvar} = cli_simple_read_float(${op.idx});`);
		} else if (op.type === 'read_stdin_double') {
			body.push(
				`${op.cvar} = cli_simple_read_double(${op.idx});`);
		} else if (op.type === "invoke") {
			gen_invoke(jaz, schema, op, heads, body);
		} else if (op.type === 'write_stdout_int') {
			body.push(`cli_simple_write_int(${op.cvar});`);
		} else if (op.type === 'write_stdout_float') {
			body.push(`cli_simple_write_float(${op.cvar});`);
		} else if (op.type === 'write_stdout_double') {
			body.push(`cli_simple_write_double(${op.cvar});`);
		} else
			nimpl(op)
	}

	var heads_cpp = '';
	for (var func in heads) {
		heads_cpp += heads[func] + '\n';
	}

	// TODO generate generated code manifest
	var argspec = schema.params.join(" ");

	body = body.map(line => '\t' + line);
	var res = head1;
	res += heads_cpp + head2;
	res += `\tcli_simple_init("${argspec}");\n`;
	res += body.join('\n') + tail;
	return res;
}

const head1 = `\
#include <stdio.h>
#include <stdlib.h>
#include <stddef.h> // for size_t

#include "cli_simple.h"

`;

const head2 = `

int main() {
`;

const tail = `
	cli_simple_finalize();
	return 0;
}// main
`;

module.exports = generate;
