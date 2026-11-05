#!/usr/bin/env node

const HELP_MSG=`\
NAME
	bari - BAR Interpreter

SYNOPSIS
	node bari.js OPTIONS FILE
	node bari.js --help

DESCRIPTION
	Execute jaz FILE, use 'main' clif interface.

	--help
		Show this help and exit

	OPTIONS:
	--iface=<iface_name>
`

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { create_bar } = require("./bar.js");
const { create_clif_opers, create_clif_demands } =
	require("./clif_opers.js");
const { abort, jclone, nimpl, parse_args } =
	require("../src/common.js");
const { create_const_opers } = require("./const_opers.js");
const execute = require("../src/execute.js");
const { log, log_enable } = require("../src/log.js");
const { create_simple_oper } = require("./simple_oper.js");
const { create_stdio_opers, stdio_write_stdout } =
	require("./stdio_opers.js");

function get_fs_code(locator) {
	assert(jaz_dir);
	var code_path = locator.substr(5);
	if (!code_path.startsWith('/'))
		code_path = path.join(jaz_dir, code_path);
	var mf = JSON.parse(
		fs.readFileSync(path.join(code_path, 'manifest.json')));
	mf['.dir'] = code_path;
	return mf;
}

function get_code(locator) {
	if (locator.startsWith("fs://")) {
		return get_fs_code(locator);
	} else if (locator.startsWith("local://code/")) {
		var id = locator.substr(13);
		return jaz.code[id];
	} else {
		nimpl(locator);
	}
}

// PARSE ARGUMENTS

// TODO make it a flag
log_enable(false);

var { keys, flags, args } = parse_args(process.argv.slice(2));
if (!('iface' in keys))
	keys.iface = 'main'; // default iface

if (flags.indexOf('help') !== -1) {
	console.log(HELP_MSG);
	process.exit(0);
}

if (args.length !== 1) {
	console.error('no input');
	process.exit(1);
}

var jaz_path = args[0];
var jaz_dir = path.resolve(path.dirname(jaz_path));
var jaz = JSON.parse(fs.readFileSync(jaz_path));
if (!('.dir' in jaz))
	jaz['.dir'] = jaz_dir;
var main_iface = jaz.iface[keys.iface];
var sys_dir = path.resolve(path.join(path.dirname(__filename), '..'));

var bar = create_bar();

// Add rules to handle stdin/stdout according to CLIF spec

bar.push(create_stdio_opers());
bar.push(create_clif_opers(main_iface));
create_clif_demands(main_iface, (varid, cb) => {
	bar.demand(varid, cb);
});

// Add rules for all operators of the cm

var cmid = main_iface.cm.substr(11);
var cm = jaz.cm[cmid];

for (var opid in cm.ops) {
	var oper = jclone(cm.ops[opid]);
	oper['.code'] = get_code(oper.code);
	switch (oper.type) {
		case 'simple': {
			var execute_ = ((oper) => ((vp, cb, end, on_fail) => {
				log("in_exec");
				execute(sys_dir, oper['.code']['.dir'], oper.args,
					vp, cb, end, on_fail);
			}))(oper);
			execute_.caption = Error().stack;
			bar.push(create_simple_oper(oper, execute_));
			break;
		}
		default:
			nimpl(oper, cm.ops, jaz.cm.sum_inc);
	}
}

// Add rules for constants

if (jaz.val)
	bar.push(create_const_opers(jaz.val));

// Upon finish ensure all demands are satisfied

bar.on_idle(() => {
	var demands = Object.keys(bar.demands);
	if (demands.length > 0) {
		abort("failed to deduce outputs", demands);
	}
});
