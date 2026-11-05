const assert = require('assert');

const { nimpl } = require("../src/common.js");
const { log } = require("../src/log.js");

function create_simple_oper(oper, execute) {
	var outputs = [];
	var inputs = [];
	var code = oper['.code'];
	var banned = false;

	assert(oper.args.length == code.params.length);
	for (var i=0; i<oper.args.length; i++) {
		switch (code.params[i].kind) {
			case 'input':
				inputs.push(oper.args[i]);
				break;
			case 'output':
				outputs.push(oper.args[i]);
				break;
			default:
				nimpl(code.params[i]);
		}
	}

	var result = function(what) {
		if (banned)
			return null;

		if (outputs.indexOf(what) === -1)
			return null;

		var deps = [];
		var vals = {};
		for (var varid of inputs) {
			if (this.is_defined(varid)) {
				if (this.is_false(varid)) {
					return null;
				} else {
					vals[varid] = {
						type: this.get_type(varid),
						value: this.get_value(varid)
					};
				}
			} else
				deps.push(varid);
		}

		if (deps.length > 0)
			return deps;

		// can compute: return computer routine
		var res = cb => {
			log("EXECUTE", oper, execute.caption);
			execute(
				varid => { 
					log("vp", varid);
					if (vals[varid] === undefined)
						nimpl(varid, vals);
					return vals[varid].value;
				},
				(varid, res) => { 
					log("got out");
					cb(varid, res.type, res.value); },
				() => {
					log("end");
				},
				() => {
					log("fail", banned);
					banned = true;
					cb(null);
				}
			);
		}
		return res;
	}
	return result;
}

module.exports = { create_simple_oper };
