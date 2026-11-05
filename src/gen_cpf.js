const assert = require('assert');

const { abort, get_single_locator, nimpl, traverse } =
	require("./common.js");
const { deduce_var_formats } = require("./gen_common.js");


function gen_cpf(jaz) {
	var plan = traverse(jaz, get_single_locator(jaz, 'plan'));
	var task = traverse(jaz, plan.task);

	if (task.format !== 'cpf')
		abort('invalid format', task);

	var cm = traverse(jaz, task.cm);

	var vars = deduce_var_formats(jaz, cm, plan.plan);

	allocate_vars(vars);

	return apply_template(
		get_
}

module.exports = (input, cb) => { cb(gen_cpf(JSON.parse(input))); };
