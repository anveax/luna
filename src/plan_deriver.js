#!/usr/bin/env node

const assert = require('assert');

const { abort, get_by_locator, nimpl, to_ref, traverse } =
	require("./common.js");
const mdijkstra = require("./mdijkstra.js");

function get_cm(jaz, cmref) {
	const local_prefix = "local://cm/";
	if (cmref.startsWith(local_prefix) === false)
		nimpl(cmref);

	let cm_name = cmref.substr(local_prefix.length);

	let cm = jaz.cm[cm_name];
	if (cm === undefined)
		abort("cannot find cm: " + cm_name);

	return cm;
}

function check_ref(ref) {
	if (typeof ref !== 'string')
		nimpl(ref);
	assert(typeof ref === 'string');
	assert(ref.match(/^[a-zA-Z_][a-zA-Z0-9_]*(:[0-9]+)*$/), ref);

	return ref;
}

function is_local_var_locator(jaz, what) {
	if (typeof what !== "string")
		return false;

	if (!what.startsWith('local://val/'))
		return false;

	var id = what.substr(12);
	return id in jaz.val;
}

function derive_plan(env, iface) {
	assert(iface !== undefined);
	var cm = env.get_cm(iface.cm);

	return mdijkstra(get_iface_inputs(iface),
		get_iface_outputs(iface), provide);

	function get_iface_inputs(iface) {
		var res = [];

		for (var param of iface.params) {
			if (param.kind !== 'input')
				continue;

			if (!is_simple_var(param.target))
				nimpl(param);

			res.push(param.target);
		}

		return res;
	}

	function get_iface_outputs(iface) {
		var res = [];

		for (var param of iface.params) {
			if (param.kind !== 'output')
				continue;

			if (!is_simple_var(param.source))
				nimpl(param);

			res.push(param.source);
		}

		return res;
	}

	function is_simple_var(what) {
		return typeof what === "string" &&
			what.indexOf("://") == -1;
		//return /^[_a-zA-Z][_0-9a-zA-Z]*$/.test(what);
	}

	function provide(varid) {
		if (varid === undefined)
			return get_inputless();
		else
			return get_consumers(varid);
	}

	function get_inputless() {
		var res = {};

		for (var opid in cm.ops) {
			var op = cm.ops[opid];
			var ins = get_inputs(op);
			if (ins.length === 0)
				res[opid] = {
					ins,
					outs: get_outputs(op)
				};
		}

		return res;
	}

	function get_consumers(varid) {
		var res = {};

		for (var opid in cm.ops) {
			var op = cm.ops[opid];
			var ins = get_inputs(op);
			if (ins.indexOf(varid) !== -1)
				res[opid] = {
					ins,
					outs: get_outputs(op)
				};
		}

		return res;
	}

	function get_inputs(op) {
		var code = env.get_code(op.code);

		assert(op.args.length === code.params.length);

		var res = [];
		var jaz = env.get_jaz();

		for (var i=0; i<op.args.length; i++) {
			if (code.params[i].kind !== 'input')
				continue;

			if (is_local_var_locator(jaz, op.args[i]))
				continue;

			if (!is_simple_var(op.args[i]))
				nimpl(op, code, i, op.args[i],
					is_local_var(jaz, op.args[i]), jaz);

			res.push(op.args[i]);
		}

		return res;
	}

	function get_outputs(op) {
		var code = env.get_code(op.code);

		assert(op.args.length === code.params.length);

		var res = [];

		for (var i=0; i<op.args.length; i++) {
			if (code.params[i].kind !== 'output')
				continue;

			if (!is_simple_var(op.args[i]))
				nimpl(op, code, i);

			res.push(op.args[i]);
		}

		return res;
	}
}

function derive_plan1(env, task) {
	var cm = env.get_cm(task.cm);

	var inputs = [];
	var outputs = [];

	for (var param of task.params) {
		switch (param.kind) {
			case 'input':
				inputs.push(check_ref(param.target));
				break;
			case 'output':
				outputs.push(check_ref(param.source));
				break;
			default:
				nimpl(param);
		}
	}
	var { get_op_args, provider } = construct_mdcons(env, cm);
	var plan = mdijkstra(inputs, outputs, provider);

	if (plan.plan === null)
		abort(env.get_jaz());

//	for (var opid of plan.sequence) {
//		console.error(opid, get_op_args(opid, 'input'),
//			get_op_args(opid, 'output'));
//	}
	var computed = {};
	inputs.forEach(x => computed[x] = true);

	for (var opid of plan.sequence) {
//		console.error(opid, get_op_args(opid, 'input'),
//			get_op_args(opid, 'output'));
		for (var x of get_op_args(opid, 'input'))
			if (!(x in computed))
				console.error("CORRUPT PLAN");
		for (var x of get_op_args(opid, 'output'))
			computed[x] = true;
	}

	return plan;
}

function construct_mdcons(env, cm) {

	function has_in(opid, x) {
		// Algorithm:
		// parse args
		// if the argument is input -- compare against x && return true
		// in the end return false
		return get_op_args(opid, 'input').indexOf(x) !== -1;
		/*
		var args = cm.ops[opid].args;
		var code = env.get_code(cm.ops[opid].code);
		var params = code.params;
		assert(args.length === params.length);
		for (var i=0; i<args.length; i++) {
			var arg = args[i];
			if (typeof arg !== 'string')
				nimpl(arg); // const?
			var param = params[i];
			if (param.kind === 'input')
				return true;
		}
		return false;
		*/
	}

	function get_op_args(opid, kind) {
		var res = [];

		var args = cm.ops[opid].args;
		var code = env.get_code(cm.ops[opid].code);
		var params = code.params;
		assert(args.length === params.length);
		for (var i=0; i<args.length; i++) {
			var arg = args[i];
			if (typeof arg !== 'string')
				nimpl(arg); // const?
			var param = params[i];
			if (param.kind !== kind || res.indexOf(arg) !== -1)
				continue;
			if (env.is_locator(arg)) {
				assert(kind === 'input');
				if (env.has_value(arg))
					continue; // not a dependency
			}
			res.push(arg);
		}
		return res;
	}

	return { get_op_args, provider: function(x) {
		if (arguments.length === 0) {
			var initial = {};
			for (var opid in cm.ops) {
				if (get_op_args(opid, 'input').length === 0)
					initial[opid] = {
						ins: [],
						outs: get_op_args(opid, 'output')
					}
			}
			return initial;
		}

		// return opid: { ins, outs } for all consumers of x
		var result = {};
		for (let opid in cm.ops) {
			if (has_in(opid, x)) {
				result[opid] = {
					ins: get_op_args(opid, 'input'),
					outs: get_op_args(opid, 'output')
				}
			}
		}
		return result;
	} }
}

module.exports = { derive_plan };
