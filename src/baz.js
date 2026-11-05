#!/usr/bin/env node
// TODO ensure only sub names in brackets are accessible in interfaces

var HELP_MSG = `\
BAZ - is a JAZ interpreter.

It implements the 'main' iface defined in JAZ file. The iface must
be a CLIF.

Usage:
	baz test.jaz
	baz --help
`;

const assert = require('assert');
const fs = require('fs');

const { abort, jclone, nimpl, parse_args } = require("./common.js");
const Interpreter = require("./ip.js");
const stdin_reader = require("./stdin_reader.js");
const LOG = require("./log.js");

var log = LOG.log;

// Routines
// --------
const INT_REGEX = /^-?\d+$/;
const REAL_REGEX = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;

function convert_string_to_type(value, type) {
	assert(typeof value === 'string');
	switch (type) {
		case 'int32':
			assert(INT_REGEX.test(value));
			return {
				type: 'int32',
				value
			};
		case 'real64':
			assert(REAL_REGEX.test(value));
			return {
				type: 'real64',
				value
			};
		case 'blob':
			assert(typeof value === "string");
			return {
				type: 'blob',
				value: fs.readFileSync(value)
			};
		default:
			nimpl(value, type, typeof value)
	}
}

function write_param_string(param, value) {
	if (param.type !== 'int32' && param.type !== 'real64'
			&& param.type !== 'string')
		nimpl(param);
	console.log(value.value);
}

function write_param_path(param, value, filename) {
	switch (param.type) {
		case 'int32': {
			var buffer = Buffer.alloc(4);
			buffer.writeInt32LE(value.value, 0);
			fs.writeFileSync(filename, buffer);
			break;
		}
		case 'real64': {
			var buffer = Buffer.alloc(8);
			buffer.writeDoubleLE(value.value, 0);
			fs.writeFileSync(filename, buffer);
			break;
		}
		case 'blob': {
			fs.writeFileSync(filename, value.value);
			break;
		}
		default:
			nimpl(...arguments);
	}
}

function write_param(param, value) {
	switch (param.format) {
		case 'string':
			return write_param_string(param, value);
		case 'path':
			return write_param_path(param, value);
		default:
			nimpl(param);
	}
}

// Returns 'lines' or 'stdin'
function get_stdin_mode(params) {
	var stdin_mode;

	function ensure(mode) {
		assert(stdin_mode === undefined || mode === stdin_mode);
		stdin_mode = mode;
	}

	for (var param of params) {
		if (param.kind === 'input' && param.format === 'string') {
			ensure('lines');
		} else if (param.kind === 'input' && param.format === 'path') {
			ensure('lines');
		} else if (param.kind === 'output'
				&& param.format === 'string') {
		} else if (param.kind === 'output'
				&& param.format === 'path') {
			ensure('lines');
		} else {
			nimpl(param);
		}
	}

	assert(stdin_mode !== undefined);
	return stdin_mode;
}

// MAIN PART
// =========


// Parse command line arguments
// ----------------------------

var { keys, flags, args } = parse_args(process.argv.slice(2));

if (flags.indexOf('help') !== -1) {
	console.log(HELP_MSG);
	process.exit(0);
}

if (flags.indexOf('v') === -1) {
	LOG.log_enable(false);
} else
	LOG.log_enable(true);

if (args.length !== 1) {
	abort("no program specified");
	process.exit(1);
}

log("verbose mode");

// Load JAZ
// --------

var jaz_path = args[0];
log("loading jaz from", jaz_path);
var jaz = JSON.parse(fs.readFileSync(jaz_path));
log("jaz loaded");

if (!('main' in jaz.iface))
	abort("no 'main' iface in jaz");

var main = jaz.iface.main;

if (main.format !== 'clif')
	nimpl('main iface is not a CLIF', main.format);

// Create Interpreter instance
// ---------------------------

log("creating interpreter instance");
var ip = new Interpreter(jaz_path, jaz, main.cm);

// Handle inputs and outputs
// -------------------------

log("handle inputs");
switch (get_stdin_mode(main.params)) {
	case 'stdin':
		var stdin = fs.readFileSync(0);
		var param = get_single_in_param(main.params);
		ip.submit(param.target, convert_stdin_to_type(stdin, param.type));
		break;
	case 'lines':
		break;
	default:
		nimpl(get_stdin_mode(main.params));
}

for (var i=0; i<main.params.length; i++) {
	var param = main.params[i];
	switch (param.kind) {
		case 'input':
			(param => { // arrow fn to make a copy of param
				stdin_reader.on_next_line(value => {
					if (param.target === undefined)
						abort(param, param);
					log("input received", value);
					ip.submit(param.target, convert_string_to_type(
						value, param.type));
				});
			})(param);
			break;
		case 'output':
			((param, i) => { // arrow fn to make a copy of param
				var pth;
				switch (param.format) {
					case 'path':
						stdin_reader.on_next_line(p => {
							pth = p;
						});
						ip.demand(param.source, value => {
							write_param_path(param, value, pth);
						});
						break;
					case 'string':
						log("output demanded", param.source);
						ip.demand(param.source, value => {
							write_param(param, value);
							log("output obtained", param, value);
						});
						break;
					default:
						nimpl(param);
				}
			})(param, i);
			break;
		default:
			abort('illegal param kind', param.kind);
	}
}

