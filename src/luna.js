#!/usr/bin/env node

const HELP_MESSAGE = `\
NAME
	luna - process active knowledge base

SYNOPSIS
	luna [OPTION]... FILE [ARGUMENT]...

OPTIONS
	--generate - Generate program from given schema

	--build - Build program schema from plan
`;

const assert = require('assert');
const fs = require('fs');

const build = require("./build.js");
const { attach, drop_hash, jclone, nimpl, parse_args, traverse } =
	require("./common.js");
const construct = require("./construct.js");
const generate = require("./generate.js");
const { derive_plan } = require("./plan_deriver.js");

function show_help_and_exit() {
	console.log(HELP_MESSAGE);
	process.exit(0);
}

function abort() {
	console.error("luna:", ...arguments);
	process.exit(1);
}

function call_generate(jaz, schema_name) {
	console.log(generate(jaz, traverse(jaz, schema_name)));
}

function call_build(jaz, plan_name) {
	console.log(JSON.stringify(build(jaz, traverse(jaz, plan_name)),
		null, 4));
}

function call_parse(path) {
	nimpl(path);
}

function call_plan(jaz, task_name) {
	console.log(JSON.stringify(derive_plan(jaz, task_name).sequence,
		null, 4));
}

function main() {
	var parsed_args;
	try {
		parsed_args = parse_args(process.argv.slice(2));
	} catch (x) {
		abort(x.message);
	}

	let { flags, keys, args } = parsed_args;

	if (flags.indexOf('help') !== -1) {
		show_help_and_exit();
	}

	function read_jaz(path) {
		try {
			return JSON.parse(drop_hash(fs.readFileSync(path)));
		} catch (err) {
			abort(err);
		}
	}

	if (flags.length === 1 && flags[0] === 'generate') {
		assert(Object.keys(keys).length === 1
			&& 'schema' in keys);
		assert(args.length === 1);
		return call_generate(read_jaz(args[0]), keys.schema);
	}

	if (flags.length === 1 && flags[0] === 'build') {
		assert(Object.keys(keys).length === 1
			&& 'plan' in keys);
		assert(args.length === 1);
		return call_build(read_jaz(args[0]), keys.plan);
	}

	if (flags.length === 1 && flags[0] === 'plan') {
		assert(Object.keys(keys).length === 1
			&& 'task' in keys);
		assert(args.length === 1);
		return call_plan(read_jaz(args[0]), keys.task);
	}

	if (flags.length === 1 && flags[0] === 'construct') {
		assert(Object.keys(keys).length === 1
			&& 'task' in keys);
		assert(args.length === 1);
		return call_construct(read_jaz(args[0]), keys.task);
	}

	if (flags.length === 1 && flags[0] === 'make-jaz') {
		assert(Object.keys(keys).length === 1
			&& 'task' in keys);
		assert(args.length === 1);
		return call_make_jaz(read_jaz(args[0]), keys.task);
	}

	if (flags.length === 1 && flags[0] === 'parse') {
		return call_parse(args[0]);
	}

	if (args.length === 0 && flags.length === 0
			&& Object.keys(keys).length === 0)
		abort("no command");

	nimpl(parsed_args, ...process.argv);
}

function call_construct(jaz, task_ref) {
	console.log(construct(jaz, task_ref).program);
}

function call_make_jaz(jaz, task_ref) {
	console.log(JSON.stringify(construct(jaz, task_ref).jaz, null, 2));
}

main();
