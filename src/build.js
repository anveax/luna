#!/usr/bin/env node

const assert = require('assert');

const { nimpl, to_ref, traverse } = require("./common.js");

const { is_format_supported } = require("./formats.js");

function create_read_stdin_oper(x, ctype, cvar, idx) {
	if (!(ctype in BASIC_CTYPES))
		nimpl(...arguments);

	return {
		type: `read_stdin_${ctype}`,
		var: x,
		idx, cvar
	}
}

function get_param_type(params, name) {
	nimpl(params, name);
	for (var param of params) {
		if (param.name === name)
			return param.type;
	}
}

function process_vars(plan, cm, jaz) {
	var next_idx=0;
	var vars = {};

	for (var opid of plan) {
		var oper = cm.ops[opid];
		var code = traverse(jaz, oper.code);
		if (code.type !== 'cpf')
			nimpl(code);
		for (var i=0; i<oper.args.length; i++) {
			var arg = oper.args[i];
			if (typeof arg === 'number')
				continue; // skip constant arguments
			var format = code.params[i].format;
			if (!is_format_supported(format))
				nimpl("add support to format", format, code.params[i],
					code);
			vars[arg] = {
				format,
				id: next_idx++
			};
		}
	}

	return vars;
}

function build(jaz, plan) {
	// Algorithm:
	// find all inputs and provide them with operators
	// loop through plan operations and for each operation:
	//    if inputs inconsistent add conversion operators
	//    add operator for operation
	// foreach output provide with operator
	// Also: when adding an operator allocate variables

	var schema = {
		carrs: {},
		cvars: {},
		opers: [],
		params: []
	};

	var task = traverse(jaz, plan.task);
	if (task.format !== 'clif')
		nimpl(task, task.format);
	var cm = traverse(jaz, task.cm);

	var allocs = {};
	var next_cvar=0;

	function allocate_arr(x, type) {
		assert(!(x in allocs), x);
		let cvar = `v${next_cvar++}`;
		var size_cvar = cvar+'_size';
		allocs[x] = {
			cvar,
			size_cvar
		};
		assert(type in BASIC_TYPES, type);
		schema.carrs[cvar] = {
			var: x,
			ctype: BASIC_TYPES[type],
			size_cvar
		}
	}

	function allocate(x, type) {
		if (type.endsWith('[]'))
			return allocate_arr(x, type.substr(0, type.length-2));
		var ctype;
		if (!(type in BASIC_TYPES))
			nimpl(type);

		assert(!(x in allocs), x);
		let cvar = `v${next_cvar++}`;
		allocs[x] = cvar;
		schema.cvars[cvar] = {
			var: x,
			ctype: BASIC_TYPES[type]
		};
	}

	var vars = process_vars(plan.plan, cm, jaz);


		nimpl(task);
	for (var idx=0; idx<inputs.length; idx++) {
		var inp = to_ref(inputs[idx]);
		allocate(inp, var_formats[inp]);
		schema.params.push('<' + var_formats[inp]);
		if (!(allocs[inp] in schema.cvars))
			nimpl(schema.cvars, allocs, inp);
		let ctype = schema.cvars[allocs[inp]].ctype;
		schema.opers.push(create_read_stdin_oper(inp, ctype, allocs[inp],
			idx));
	}

	for (var opid of plan.plan) {
		var operat = {
			type: 'invoke',
			operation: opid,
			args: []
		};
		var oper = cm.ops[opid];
		var code = traverse(jaz, oper.code);
		assert(oper.args.length === code.params.length);
		for (var i=0; i<oper.args.length; i++) {
			var arg = oper.args[i];
			var param = code.params[i];
			if (typeof arg === 'number') {
				assert(param.kind === 'input');
				operat.args.push(arg);
			} else {
				arg = to_ref(arg);
				if (param.kind === 'output')
					allocate(arg, var_formats[arg]);
				operat.args.push(allocs[arg]);
			}
		}
		schema.opers.push(operat);
	}

	for (var out of outputs) {
		schema.params.push('>' + var_formats[to_ref(out)]);
	}

	for (var out of outputs) {
		out = to_ref(out);
		let ctype = schema.cvars[allocs[out]].ctype;
		if (!(ctype in BASIC_CTYPES))
			nimpl(ctype);

		schema.opers.push({
			type: `write_stdout_${ctype}`,
			cvar: allocs[out]
		});
	}

	return schema;
}

module.exports = build;
