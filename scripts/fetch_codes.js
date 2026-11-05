#!/usr/bin/env node

/*

CLIF specs:

input path jaz
output path jaz
output path deps

*/

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { abort, jclone, nimpl } = require("../src/common.js");

const input = fs.readFileSync(0, "utf-8").split('\n');

const [ jaz_path, jazf, deps ] = input;

//nimpl(process.argv, input, 'curpath='+path.resolve('.'));

// Okay, we have to loop through all mentioned code references and
// replace them with locals (and fetch them on use)

var next_id = 0;
function create_next_local_ref(jaz) {
	if (!('code' in jaz))
		jaz.code = {};

	while (true) {
		var local_id = '_code_' + next_id;
		next_id++;
		if (!(local_id in jaz.code))
			return local_id;
	}
}

function is_local_ref(ref) {
	return ref.startsWith('local://code/');
}

var replaces = {};

function replaced(code, jaz) {
	if (code in replaces)
		return replaces[code].ref;

	if (code.startsWith('fs://')) {
		// TODO extract to a function
		var code_dir = code.substr(5);
		if (!code_dir.startsWith('/'))
			code_dir = path.join(jaz['.base_dir'], code_dir);
		var code_path = path.join(code_dir, 'manifest.json');
		var manifest = JSON.parse(fs.readFileSync(code_path));
		assert(manifest.type === 'codefrag');
		var local_id = create_next_local_ref(jaz);
		jaz.code[local_id] = manifest;
		manifest['.dir'] = code_dir;
		replaces[code] = {
			ref: `local://code/${local_id}`,
			path: code_dir
		};
	} else
		nimpl(code);

	assert(code in replaces);
	return replaces[code].ref;
}

var jaz = JSON.parse(fs.readFileSync(jaz_path));

for (var cmid in jaz.cm) {
	var cm = jaz.cm[cmid];

	for (var opid in cm.ops) {
		var op = cm.ops[opid];
		if (!is_local_ref(op.code))
			op.code = replaced(op.code, jaz);
	}
}

function get_deps_old() {
	var res = [];
	for (var id in replaces) {
		res.push(path.join(replaces[id].path, '*.c'));
	}
	return res;
}

function unique(arr) {
	var m = {}
	arr.forEach(item => m[item] = null);
	return Object.keys(m);
}

function get_deps() {
	var deps = [];
	for (var code_id in jaz.code) {
		var code = jclone(jaz.code[code_id]);
		if (code.src === undefined)
			continue;
		if (typeof code.src === "string")
			code.src = [code.src];
		for (var src of code.src) {
			var dep = path.join(code['.dir'], src);
			deps.push(dep);
		}
	}
	return unique(deps);
}

function check_compatibility(decl, mf) {
	if (decl.params.length !== mf.params.length)
		abort(decl, mf);
	for (var i=0; i<decl.params.length; i++) {
		var p = decl.params[i];
		var q = mf.params[i];
		if (p.kind !== q.kind
				|| p.type !== q.type)
			nimpl(decl, mf, p, q);
		assert(p.kind == q.kind);
		assert(p.type == q.type);
	}
}

function load_codes() {
	for (var code_id in jaz.code) {
		var code = jaz.code[code_id];
		var external_code_id = code.code_id;
		if ('format' in code)
			continue; // already loaded

		var code_dir = external_code_id;
		if (!code_dir.startsWith('/'))
			code_dir = path.join(jaz['.base_dir'], code_dir);
		if (!fs.existsSync(code_dir))
			abort("code", code_id, "not found at", code_dir, code);
		var code_path = path.join(code_dir, 'manifest.json');
		if (!fs.existsSync(code_path))
			abort("manifest for code", code_id, "not found at",
				code_path);
		var manifest = JSON.parse(fs.readFileSync(code_path));
		assert(manifest.type === 'codefrag');
		check_compatibility(code, manifest);
		jaz.code[code_id] = manifest;
		manifest['.dir'] = code_dir;
	}
}

load_codes();

fs.writeFileSync(jazf, JSON.stringify(jaz, null, 2));
fs.writeFileSync(deps, get_deps().join("\n"));
