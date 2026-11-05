#!/usr/bin/env node


// CLIF:
// in path clif
// in string wrapper func name
// out path cpf

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { 
	build_params_scheme,
	ensure_dir_exists,
	to_ctype
} = require("../src/code_helpers.js");
const { nimpl } = require("../src/common.js");

const generate_cpf_clif_wrapper =
	require("../src/generate_cpf_clif_wrapper.js");

var lines = fs.readFileSync(0, "utf-8").split("\n");
assert(lines.length >= 2);
var clif_path = lines[0];
var c_func_name = lines[1];
var cpf_path = lines[2];

var info = JSON.parse(fs.readFileSync(path.join(clif_path,
	'manifest.json')));

var listing = generate_cpf_clif_wrapper(info, c_func_name);
var manifest = {
	type: 'codefrag',
	format: 'cpf',
	c_func_name,
	params: info.params
}

ensure_dir_exists(cpf_path);
fs.writeFileSync(path.join(cpf_path, "code.c"), listing, "utf-8");
fs.writeFileSync(path.join(cpf_path, 'manifest.json'),
	JSON.stringify(manifest, null, 2), "utf-8");
