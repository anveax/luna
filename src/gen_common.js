const assert = require('assert');

const { abort, nimpl, traverse } = require("./common.js");

function deduce_var_info(jaz, cm, plan) {
	// Algorithm:
	// for each operation in plan
	// check its args against param types of code fragments
	var vars = {};

	function read_var_info(ref, info) {
		assert(typeof ref === "string");
		if (ref in vars) {
			if (vars[ref].type !== info.type)
				abort(ref, vars[ref], info,
					JSON.stringify(vars[ref].type),
					JSON.stringify(info.type),
					vars[ref].type===info.type);
		}
		vars[ref] = { type: info.type };
	}

	for (var opid of plan) {
		var op = cm.ops[opid];
		var code = traverse(jaz, op.code);
		var args = op.args;
		var params = code.params;

		assert(args.length === params.length);
		for (var i=0; i<args.length; i++) {
			if (typeof args[i] !== 'string')
				nimpl(args[i]); // not a var name? but what?
			read_var_info(args[i], params[i]);
		}
	}

	return vars;
}

module.exports = { deduce_var_info };
