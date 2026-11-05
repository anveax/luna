const assert = require('assert');
// TODO sends

const { abort, nimpl, traverse, unique } = require("./common.js");

function get_inputs(args, params) {
	var res = [];
	assert(args.length === params.length);
	for (var i=0; i<args.length; i++) {
		if (params[i].kind === 'input')
			res.push({
				varid: args[i],
				type: params[i].type
			});
	}
	return res;
}

function get_outputs(env, cm, opid) {
	var op = cm.ops[opid];
	var args = op.args;
	var params = env.get_code(op.code).params;
	var res = [];
	assert(args.length === params.length);
	for (var i=0; i<args.length; i++) {
		if (params[i].kind === 'output')
			res.push(args[i]);
	}
	return res;
}


function gen_op_deps(env, cm, opid) {
	var op = cm.ops[opid];
	var code = env.get_code(op.code);

	var inputs = get_inputs(op.args, code.params);
	inputs = inputs.map(({ varid, type }) => `"${varid}"`);
	inputs = inputs.join(", ");
	return `{${inputs}}`;
}

function defined(what) {
	assert(what !== undefined);
	return what;
}

function to_ctype(type) {
	ctypes = {
		int32: "int",
		real64: "double"
	}
	return defined(ctypes[type]);
}

function op_consumes(opid, varid, cm, env) {
	var op = cm.ops[opid];
	var code = env.get_code(op.code);
	var inputs = get_inputs(op.args, code.params);
	for (var item of inputs)
		if (item.varid === varid)
			return true;
	return false;
}

function get_consumer_ranks(varid, schedule, cm, env) {
	var consumer_ranks = [];

	for (var item of schedule.schedule) {
		if (op_consumes(item.operation_id, varid, cm, env))
			consumer_ranks.push(item.processor_id);
	}

	return unique(consumer_ranks);
	nimpl(varid, schedule);
}

function gen_invoke(env, cm, opid, schedule) {
	var op = cm.ops[opid];
	var code = env.get_code(op.code);
	var args = op.args;
	var params = code.params;

	var inv_args = [];
	var fwd_params = [];

	assert(args.length === params.length);
	for (var i=0; i<args.length; i++) {
		var param = params[i];
		var arg = args[i];
		var cvar = `_arg_${i}`;
		
		if (param.kind === 'input') {
			switch (param.type) {
				case 'int32':
				case 'real64':
					inv_args.push({
						cvar,
						decl: `${to_ctype(param.type)} ${cvar} = ` +
							`get_value_${param.type}("${arg}");`,
						subst: cvar
					});
					fwd_params.push(to_ctype(param.type));
					break;
				default: 
					nimpl(arg, param);
			}
		} else if (param.kind === 'output') {
			switch (param.type) {
				case 'int32':
				case 'real64':
					inv_args.push({
						cvar,
						decl: `${to_ctype(param.type)} ${cvar}; // ${arg}`,
						subst: `&${cvar}`,
						submit: `submit_${param.type}("${arg}", ${cvar}, -1);`,
						send: get_consumer_ranks(arg, schedule, cm,
							env).map(rank =>
							`send_${param.type}(${rank}, "${arg}", ` +
							`${cvar});`).join(' ')
					});
					fwd_params.push(to_ctype(param.type) + ' *');
					break;
				default: 
					nimpl(arg, param);
			}
		} else
			abort('illegal kind', param.kind);
	}

	if (code.format !== 'cpf')
		nimpl("make wrapper or what", code);

	var decls = inv_args.map(item => item.decl);
	var args = inv_args.map(item => item.subst).join(", ");
	var submits = inv_args.map(item => item.submit);
	var sends = inv_args.map(item => item.send);
	var invoke = `[]() {
		${decls.join("\n\t\t")}
		${code.c_func_name}(${args});
		${submits.join("\n\t\t")}
		${sends.join("\n\t\t")}
	}`;
	var fwd_decl = `void ${code.c_func_name}(${fwd_params.join(", ")});`;
	return { invoke, fwd_decl, c_func_name: code.c_func_name };
}

function parse_iface(iface, var_ranks) {
	var on_inputs = {
		int32: [],
		real64: [],
		string: [],
		blob: []
	};
	var on_outputs = [];

	for (var param of iface.params) {
		if (param.kind === 'input') {
			switch (param.type) {
				case 'int32':
					on_inputs[param.type].push(
						`if (strcmp(name, "${param.name}") == 0) ` +
						`submit_${param.type}("${param.target}", value, -1);`);
						// TODO count
					break;
				default:
					nimpl(param);
			}
		} else if (param.kind === 'output') {
			switch (param.type) {
				case 'int32':
					assert(param.source in var_ranks);
					on_outputs.push(
						`if (get_rank() == ${var_ranks[param.source]}) ` +
						`{ wait_for("${param.source}"); ` +
						`write_dump_${param.type}("${param.name}", ` +
							`get_value_${param.type}("${param.source}")); }`);
					break;
				default:
					nimpl();
			}
		} else
			abort('illegal kind', param.kind);
	}
	return { on_inputs, on_outputs };
}

// TODO write outputs to stdout
// TODO deallocate memory upon last use within node

function gen_mpi_dclif(env, iface, plan) {
	var schedule = env.get_first_schedule();
	var jaz = env.get_jaz();
	var plan = traverse(jaz, schedule.plan);
	var iface = traverse(jaz, plan.iface);
	var cm = traverse(jaz, iface.cm);
	var init_ops = [];
	var fwd_decls = {};
	var var_ranks = {};
	for (var item of schedule.schedule) {
		var opid = item.operation_id;
		var deps = gen_op_deps(env, cm, opid);
		get_outputs(env, cm, opid).forEach(varid => 
			var_ranks[varid] = item.processor_id);
		var { invoke, fwd_decl, c_func_name } = gen_invoke(env, cm, opid,
			schedule);
		fwd_decls[c_func_name] = fwd_decl;
		init_ops.push(`enqueue(
		${item.processor_id},
		"${opid}", // operation id
		${deps}, // dependencies
		${invoke});`);
	}
	fwd_decls = Object.keys(fwd_decls).map(id => fwd_decls[id]);
	var { on_inputs, on_outputs } = parse_iface(iface, var_ranks);
	for (var type in on_inputs) {
		if (on_inputs[type].length > 0)
			on_inputs[type].push(
				`{ fprintf(stderr, "unexpected input: %s (${type})\\n", ` +
				`name); exit(1); }`
			);
	}
	var listing = `\
// Generated by src/gen_mpi_dclif.js
#include <string.h>
#include "dclif.h"

${fwd_decls.join("\n")}

void on_input_int32(const char *name, int value) {
	${on_inputs.int32.join("\n\telse ")}
}
void on_input_real64(const char *name, double value) {
	${on_inputs.real64.join("\n\t")}
}
void on_input_string(const char *name, const char *data, size_t size) {
	${on_inputs.string.join("\n\t")}
}
void on_input_blob(const char *name, const void *data, size_t size) {
	${on_inputs.blob.join("\n\t")}
}
void init_dclif_ops() {
	${init_ops.join('\n\t')}
}

void write_outputs() {
	${on_outputs.join("\n\t")}
}

int main(int argc, char **argv) { return dclif_main(&argc, &argv); }
`;

	return { manifest: iface, listing };
}

module.exports = gen_mpi_dclif;
