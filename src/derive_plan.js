/*

CLIF-stdio base.jaz => plan.json

*/

const assert = require('assert');
const fs = require('fs');

const { abort, nimpl, traverse } = require("./common.js");
const { derive_plan } = require("./plan_deriver.js");

function get_the_only_task_locator(jaz) {
	var task_ids = Object.keys(jaz.task);
	assert(task_ids.length === 1);
	return 'local://task/' + task_ids[0];
}

var jaz = JSON.parse(fs.readFileSync(0, "utf-8"));

var task_locator = get_the_only_task_locator(jaz)
var plan=derive_plan(jaz, task_locator);

if (plan.sequence === null)
	abort("failed to deduce plan", traverse(jaz, task_locator), plan);

var plan1 = {
	plan: plan.sequence,
	task: task_locator
};
console.log(JSON.stringify(plan1, null, 2));
