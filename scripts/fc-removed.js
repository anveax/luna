#!/usr/bin/env node

/*

CLIF specs:

input path blob jaz
output path blob jaz
output path blob deps

*/

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { nimpl, abort } = require("../src/common.js");

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
		var code_dir = code.substr(5);
		var code_path = path.join(code_dir, 'manifest.json');
		var manifest = JSON.parse(fs.readFileSync(code_path));
		assert(manifest.type === 'codefrag');
		var local_id = create_next_local_ref(jaz);
		jaz.code[local_id] = manifest;
		replaces[code] = {
			ref: `local://code/${local_id}`,
			path: code_dir
		};
	} else
		nimpl(code);

	assert(code in replaces);
	return replaces[code].ref;
}

function check_compatibility(brief, full) {
	// todo
}

function locate_code(code_id) {
	var code_dir = code_id;
	var code_path = path.join(code_dir, 'manifest.json');
	var manifest = JSON.parse(fs.readFileSync(code_path));
	assert(manifest.type === 'codefrag');
	return manifest;
}

var jaz = JSON.parse(fs.readFileSync(jaz_path));

function get_deps(jaz) {
// TODO: Убрать этот костыль, сделать под общий случай ФК, а не только CPF
	var res = [];
	for (var code_id in jaz.code) {
		var mf = jaz.code[code_id];
		if (mf.format !== 'cpf')
			continue;
		res.push(mf.src);
	}
	return res;
}

fs.writeFileSync(jazf, JSON.stringify(jaz, null, 2));
fs.writeFileSync(deps, "TO BE REMOVED (src/fetch.codes.js)");
