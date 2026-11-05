#!/usr/bin/env node


/*
CLIF
	in path cpf
	out path clif
*/

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
	build_clif_params_scheme,
	is_no_streams_scheme,
	ensure_dir_exists,
	gen_signature,
	to_ctype
} = require("../src/code_helpers.js");
const { abort, jclone, nimpl } = require("../src/common.js");

function gen_decl(format, cvar) {
	switch (format) {
		case 'int32':
		case 'real64':
			return `${to_ctype(format)} ${cvar};`;
		case 'blob':
			return `void *${cvar}; size_t ${cvar}_size;`;
		case 'string':
			return `char *${cvar};`;
		default:
			nimpl(format, cvar);
	}
}

function gen_read(item, stdin_idx) {
	switch (item.kind) {
		case 'value': {
			var cvar = `_v${item.param_idx}`;
			return `${cvar} = parse_${item.format
				}(stdin_lines[${stdin_idx}]);`;
		}
		case 'read_path': {
			var cvar = `_v${item.param_idx}`;
			return `read_path_blob(stdin_lines[${stdin_idx}], ` +
				`&${cvar}, &${cvar}_size);`;
		}
		default:
			nimpl(item);
	}
}

function parse_stdin_line(info, stdin_idx, reads, frees) {
	if (info.kind === 'input' && info.format === 'string') {
		reads.push(`// Read ${info.cvar} from input string as `
			+ info.type);
		reads.push(`${info.cvar} = parse_${info.type}(stdin_lines[` +
			`${stdin_idx}]);`);
	} else if (info.kind === 'output' && info.format === 'path') {
		// do nothing -- we have already read the path
	} else if (info.kind === 'input' && info.format === 'path') {
		reads.push(`read_path_blob(stdin_lines[` +
			`${stdin_idx}], &${info.cvar}, &${info.cvar}_size);`);
		frees.push(`free(${info.cvar});`);
	} else {
		nimpl(info, stdin_idx);
	}
}

function gen_param(param, idx, scheme) {
	switch (param.kind) {
		case 'input':
			switch (param.format) {
				case 'int32':
				case 'int64':
				case 'real32':
				case 'real64':
					return `_v${idx}`;
				case 'blob':
					return `_v${idx}, _v${idx}_size`;
				default:
					nimpl(param);
			}
		case 'output':
			switch (param.format) {
				case 'int32':
				case 'real64':
				case 'string':
					return `&_v${idx}`;
				case 'blob':
					return `&_v${idx}, &_v${idx}_size`;
				default:
					nimpl(param);
			}
		default:
			nimpl(param);
	}
}

function gen_write(param, i, scheme) {
	var info;
	if (scheme.output !== undefined) {
		scheme.output.forEach(n => {
			if (n.param_idx === i) {
				assert(info === undefined);
				info = n;
			}
		});
	} else {
		scheme.input.forEach(n => {
			if (n.param_idx === i) {
				assert(info === undefined);
				info = n;
			}
		});
	}
	switch (info.kind) {
		case 'value':
			switch (info.format) {
				case 'int32':
				case 'real64':
				case 'string':
					return `write_line_${info.format}(_v${i});`
				default:
					nimpl(info);
			}
		case 'write_path':
			return `write_path_blob(stdin_lines[${i}], _v${i}, ` +
				`_v${i}_size);`;
		default:
			nimpl(info);
	}
	assert(info !== undefined);
	nimpl(param, info, i);
	switch (item.kind) {
		case 'value':
		default:
			nimpl(item);
	}
	nimpl(item, i);
}

// This function generates C code with 'main' function which
// implements CLIF interface wrapper over CPF code fragment.
// CLIF formats for arguments are deduced automatically, because
// anyway we can call it.
function generate_clif_cpf_wrapper(info, clif_info) {
	info = jclone(info);
	clif_info = jclone(clif_info);
	var scheme = build_clif_params_scheme(clif_info.params);

	if (!is_no_streams_scheme(scheme))
		nimpl(scheme);

	// Generate local vars for each parameter
	var locals = [];
	for (var i=0; i<info.params.length; i++) {
		var param = info.params[i];
		var cvar = `_v${i}`;
		param.cvar = cvar;
		clif_info.params[i].cvar = cvar;

		locals.push(gen_decl(param.format, cvar));
	}
	locals = locals.join("\n\t");

	var reads = [];
	var frees = [];
	for (var i=0; i<scheme.input.length; i++) {
		// here we need to read i-th argument from stdin
		var item = scheme.input[i];
		parse_stdin_line(clif_info.params[item], i, reads, frees);
	}
	reads = reads.join("\n\t");
	frees = frees.join("\n\t");

	var args = [];
	for (var i=0; i<info.params.length; i++) {
		var param = info.params[i];
		args.push(gen_param(param, i, scheme));
	}
	invoke = `${info.c_func_name}(${args.join(", ")});`;

	var writes = [];
	if (scheme.output !== undefined) {
		for (var param_idx of scheme.output) {
			var param = clif_info.params[param_idx];
			switch (param.type) {
				case 'int32':
				case 'real64':
				case 'string':
					writes.push(`write_line_${param.type}(` +
						`${param.cvar});`);
					break;
				default:
					nimpl(param);
			}
		}
	}

	// handle output paths
	for (var stdin_idx=0; stdin_idx < scheme.input.length;
			stdin_idx++) {
		var param_idx = scheme.input[stdin_idx];
		var param = clif_info.params[param_idx];

		if (param.kind !== 'output' || param.format !== 'path')
			continue;

		switch (param.type) {
			case 'blob':
				writes.push(`write_path_blob(stdin_lines` +
					`[${stdin_idx}], ${param.cvar}, ` +
					`${param.cvar}_size);`);
				break;
			default:
				nimpl(param);
		}
	}
	writes = writes.join("\n\t");

	var res = `\
#include "clif.h"
#include <stdlib.h>

${gen_signature(info)};

int main() {
	const char **stdin_lines = parse_stdin_lines();

	// locals:
	${locals}

	// read inputs:
	${reads}

	// invoke
	${invoke}

	// write outputs
	${writes}

	free(stdin_lines[0]);
	free(stdin_lines);

	// free input args
	${frees}

	return 0;
}
`;
	return res;
}

var lines = fs.readFileSync(0, "utf-8").split('\n');
assert(lines.length >= 2);
var cpf_path = lines[0];
var clif_path = lines[1];

var info = JSON.parse(fs.readFileSync(path.join(cpf_path,
	'manifest.json')));

var manifest = {
	type: 'codefrag',
	format: 'clif',
	params: [],
	src: 'code.c'
}

for (var param of info.params) {
	switch (param.type) {
		case 'int32':
		case 'real64':
		case 'string':
			manifest.params.push({
				kind: param.kind,
				type: param.type,
				format: 'string'
			});
			break;
		case 'blob':
			manifest.params.push({
				kind: param.kind,
				type: param.type,
				format: 'path'
			});
			break;
		default:
			nimpl(param);
	}
}

var main = generate_clif_cpf_wrapper(info, manifest);

ensure_dir_exists(clif_path);
fs.writeFileSync(path.join(clif_path, 'code.c'), main, 'utf-8');
fs.writeFileSync(path.join(clif_path, 'manifest.json'),
	JSON.stringify(manifest, null, 2), "utf-8");

