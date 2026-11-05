#!/usr/bin/env node

const { abort, attach, traverse } = require("./common.js");
const { derive_plan } = require("./plan_deriver.js");
const build = require("./build.js");
const generate = require("./generate.js");

function construct(jaz, task_ref) {
	
}

function construct_old(jaz, task_ref) {
	let task = traverse(jaz, task_ref);

	let plan = {
		plan: derive_plan(jaz, task_ref).sequence,
		task: task_ref
	};

	if (plan.plan === null) {
		abort("failed to deduce plan", jaz, task_ref);
	}

	let schema = build(jaz, plan);
	let plan_id = attach(jaz, 'plan', plan);
	schema.plan = plan_id;
	let schema_id = attach(jaz, 'schema', schema);
	let program = generate(jaz, schema);

	return { program, jaz };
}

module.exports = construct;
