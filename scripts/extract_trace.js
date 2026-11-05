/*
	Converts jaz with plan (e.g. 80_plan.jaz) into a trace format,
		that can be passed to dump visualizer: vis_trace.js
	CLIF specs:
	in stdin blob jaz
	out stdout blob trace
*/

const fs = require('fs');

const { nimpl } = require("../src/common.js");

var jaz = JSON.parse(fs.readFileSync(0));

var plan_id = Object.keys(jaz.plan)[0];
var plan = jaz.plan[plan_id];
var iface_id = plan.iface.substr(14);
var iface = jaz.iface[iface_id];
var cmid = iface.cm.substr(11);
var cm = jaz.cm[cmid];

var trace = [];
var record = {
	code: '(input)',
	args: []
};

for (var param of iface.params) {
	if (param.kind !== 'input')
		continue;

	record.args.push({
		kind: 'output',
		varid: param.target,
		type: param.type
	});
}

trace.push(record);

for (var opid of plan.sequence) {
	var op = cm.ops[opid];
	var code_id = op.code.substr(13);
	var code = jaz.code[code_id];

	var args = op.args;
	var params = code.params;

	var record = {
		code: code.format === 'cpf'? code.c_func_name: nimpl(code),
		args: []
	}

	for (var i=0; i<args.length; i++) {
		record.args.push({
			kind: params[i].kind,
			varid: args[i],
			type: params[i].type
		});
	}

	trace.push(record);
}

record = {
	code: '(output)',
	args: []
};

for (var param of iface.params) {
	if (param.kind !== 'output')
		continue;

	record.args.push({
		kind: 'input',
		varid: param.source,
		type: param.type
	});
}

trace.push(record);

console.log(JSON.stringify(trace, null, 2));
