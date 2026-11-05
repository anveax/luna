// PLAN:
// in path jaz
// out path out_plan

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { abort, get_single_locator, nimpl, traverse } =
	require("../src/common.js");
const Env = require("../src/env.js");
const { derive_plan } = require("../src/plan_deriver.js");
const attach = require('../src/attach.js');

function gen_plan(env, iface) {
	if (iface === undefined)
		iface = env.get_first_iface();

	var useful = true;
	while (useful) {
		useful = false;
		try {
			return derive_plan(env, iface);
		} catch (err) {
			// проверка на ошибку неизвестного типа
			// !здесь должна быть вариативность!

			//
			if (err instanceof Env.CodeError) {
				var purged = env.purge_codefrag(err.locator);
				if (Object.keys(purged).length > 0)
					useful = true;
			} else
				nimpl(err);
		}
	}
	nimpl("deduce plan failed?");
}

var env;
function obtain_plan(jaz, iface) {
	env = new Env(JSON.parse(JSON.stringify(jaz)));
	//var plan = gen_plan(env, iface);
	if (iface === undefined) {
		if (!('iface' in jaz))
			abort(jaz);
		iface = traverse(jaz, get_single_locator(jaz, 'iface'));
		assert(iface !== undefined);
		iface["name"] = Object.keys(jaz.iface)[0];
	}
	var plan = derive_plan(env, iface);

	var plan_item = {};
    plan_item["iface"] = "local://iface/" + iface.name;
	plan_item["plan"] = plan.plan;
	plan_item["sequence"] = plan.sequence;
	plan_item["score"] = plan.score;

	var new_jaz = attach(jaz, 'plan', 'plan1', plan_item);

	return new_jaz;
}

module.exports = obtain_plan;
