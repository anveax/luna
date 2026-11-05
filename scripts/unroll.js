#!/usr/bin/env node

const HELP_MSG = `\
Unroll loops in LuNA-6 JSON
Usage:
	cat file.ja | node unroll.js > file.uja`

const assert = require('assert');
const fs = require('fs');

const { abort, jclone, nimpl } = require("../src/common.js");

function subst_expr(expr, substs) {
	assert(arguments.length === 2);
	expr = jclone(expr);
	switch (expr.type) {
		case 'id': {
			var ref = jclone(expr.ref);
			if (ref.length === 1) {
				if (ref[0] in substs) {
					return { type: 'iconst', value: substs[ref[0]] };
				} 
			} else {
				for (var i=1; i<ref.length; i++)
					ref[i] = subst_expr(ref[i], substs);
			}
			expr.ref = ref;
			return expr;
		}
		case '-':
		case '+':
		case '*':
		case '/':
			expr.operands = expr.operands.map(op =>
				subst_expr(op, substs));
			return expr;
		case 'iconst':
			return expr;
		default:
			nimpl(expr, substs);
	}
}

function subst_exec(bi, substs) {
	assert(arguments.length === 2);

	if (bi.id.length !== 1)
		nimpl(bi);

	var substs_idx = Object.keys(substs).sort().map(name =>
		substs[name]).join('_');
	var res = {
		type: 'exec',
		id: [ `_loop_${bi.id}_${substs_idx}` ],
		code: bi.code,
		args: []
	};

	for (var arg of bi.args) {
		res.args.push(subst_expr(arg, substs));
	}

	return res;
}

function eval_expr(expr) {
	switch (expr.type) {
		case 'iconst':
			return expr.value;
		case '+':
			assert(expr.operands.length === 2);
			return eval_expr(expr.operands[0]) +
				eval_expr(expr.operands[1]);
		case '-':
			assert(expr.operands.length === 2);
			return eval_expr(expr.operands[0]) -
				eval_expr(expr.operands[1]);
		case '/':
			assert(expr.operands.length === 2);
			return eval_expr(expr.operands[0]) /
				eval_expr(expr.operands[1]);
		case '*':
			assert(expr.operands.length === 2);
			return eval_expr(expr.operands[0]) *
				eval_expr(expr.operands[1]);
		default:
			nimpl(expr);
	}
}

function unroll(for_bi, subst_names) {
	if (subst_names === undefined)
		subst_names = {};
	assert(for_bi.type === 'for');

	var first = eval_expr(for_bi.first);
	var last = eval_expr(for_bi.last);

	var items = [];
	var name = for_bi.var;

	for (var i=first; i<=last; i++) {
		for (var bi of for_bi.body) {
			switch (bi.type) {
				case 'dfs':
					continue;
				case 'exec': {
					var subst_names_i = jclone(subst_names);
					subst_names_i[name] = i;
					items.push(subst_exec(bi, subst_names_i));
					break;
				}
				case 'for': {
					var subst_names_i = jclone(subst_names);
					subst_names_i[name] = i;
					unroll(bi, subst_names_i).forEach(item =>
						items.push(item));
				}
			}
		}
	}

	return items;
}

function unroll_sub(sub) {
	assert(sub.type === 'struct');

	var new_body = [];

	// parse body
	for (var bi of sub.body) {
		switch (bi.type) {
			case 'dfs':
			case 'exec':
				new_body.push(bi);
				break;
			case 'for':
				unroll(bi).forEach(item => new_body.push(item));
				break;
			default:
				nimpl(bi);
		}
	}

	sub.body = new_body;
	return sub;
}

function convert(ja) {
	// Algorithm:
	// Loop through subs and convert 'import' and 'export' subs
	// to code fragments and cms+tasks

	// First parse imports, then exports
	for (var sub_name in ja) {
		var sub = ja[sub_name];

		switch (sub.type) {
			case 'import':
				break;
			case 'struct':
				ja[sub_name] = unroll_sub(ja[sub_name]);
				break;
			case 'iface':
				break;
			default:
				nimpl(ja[sub_name], sub_name, ja);
		}
	}

	return ja;
}

var ja = JSON.parse(fs.readFileSync(0, 'utf-8'));

console.log(JSON.stringify(convert(ja), null, 2));

