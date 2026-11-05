// CLIF:
// in path clif
// in string wrapper func name
// out path cpf

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { 
	build_clif_params_scheme,
	is_no_streams_scheme,
	ensure_dir_exists,
	to_ctype
} = require("./code_helpers.js");
const { abort, jclone, nimpl } = require("../src/common.js");

function gen_named_param(kind, type, cvar) {
	assert(kind === 'input' || kind === 'output');
	switch (type) {
		case 'int32': {
			var decl = to_ctype(type);
			if (kind === 'output')
				decl += ` *${cvar}`;
			else
				decl += ` ${cvar}`;
			return decl;
		}
		case 'blob': {
			return kind === 'input'?
				`const void *${cvar}, size_t ${cvar}_size`:
				`void **${cvar}, size_t *${cvar}_size`;
		}
		case 'string':
			if (kind === 'input')
				return `const char *${cvar}`;
			else
				return `char **${cvar}`;
		default:
			nimpl(...arguments);
	}
}

function to_fstring(format) {
	switch (format) {
		case 'int32':
			return '%d';
		default:
			nimpl(format);
	}
}

function gen_write_stream(item) {
	assert(item.kind === 'input' && item.format === 'stdin');
	switch (item.type) {
		case 'blob':
			return `write(pin, ${item.cvar}, ${item.cvar}_size);`;
		default:
			nimpl();
	}
}

function gen_write(item, writes) {
	assert(arguments.length === 2);
	if (item.kind === 'input' && item.format === 'path') {
		// Here we need to generate a snippet, that will create
		// a temp file, store data into it, write filename into
		// pin, and delete temp file in del_temp
		writes.push(`// passing ${item.kind} ${item.cvar} ` +
			`${item.type} via file`);
		writes.push(`sprintf(temp_path, "%s/arg_${item.cvar}", ` +
			`temp_dir);`);
		switch (item.type) {
			case 'int32':
			case 'real64':
			case 'string':
				writes.push(`write_path_${item.type}` +
					`(temp_path, ${item.cvar});`);
				break;
			case 'blob':
				writes.push(`write_path_blob(temp_path, ` +
					`${item.cvar}, ${item.cvar}_size);`);
				break;
			default:
				nimpl(item);
		}
		writes.push(`dprintf(pin, "%s\\n", temp_path);`);
		writes.push(``);
	} else if (item.kind === 'output' && item.format === 'path') {
		// Here we need to generate a snippet which will create
		// an empty temp file, and pass its name to pin. And don't
		// forget to delete it.
		writes.push(`// passing path for output ${item.type} ` +
			`${item.cvar}`);
		writes.push(`sprintf(temp_path, "%s/arg_${item.cvar}", ` +
			`temp_dir);`);
		writes.push(`dprintf(pin, "%s\\n", temp_path);`);
		writes.push(``);
	} else if (item.kind === 'input' && item.format === 'string') {
		// Here we need to generate a snippet which transform
		// a value into a string format and pass it to pin
		writes.push(`// passing input ${item.type} as string`);
		switch (item.type) {
			case 'int32':
				writes.push(`dprintf(pin, "%d\\n", ${item.cvar});`);
				break;
			case 'real64':
				writes.push(`dprintf(pin, "%lf\\n", ${item.cvar});`);
				break;
			case 'string':
				writes.push(`dprintf(pin, "%s\\n", ${item.cvar});`);
				break;
			default:
				nimpl(item);
		}
	} else {
		nimpl(item);
	}
}

function to_lvalue(info, cvar) {
	switch (info.kind) {
		case 'output':
			switch (info.type) {
				case 'int32':
					return `*${cvar}`;
				default:
					nimpl(info);
			}
		default:
			nimpl(info);
	}
}

function gen_read(item, line_num) {
	switch (item.format) {
		case 'string': {
			return `${to_lvalue(item, item.cvar)} = ` +
				`parse_${item.type}(lines[${line_num}]);`;
		}
		default:
			nimpl(item);
	}
}

function gen_read_stream(item) {
	assert(item.kind === 'output' && item.format === 'stdout');
	switch (item.type) {
		case 'blob':
			return `read_file_blob(pout, ${item.cvar}, ${item.cvar}_size);`;
		default:
			nimpl(item);
	}
}

// This function generates C code (without 'main') which implements
// CPF interface wrapper over CLIF code fragment.
function generate_cpf_clif_wrapper(info, c_func_name, cloc) {
	info = jclone(info);
	var scheme = build_clif_params_scheme(info.params);

	// Names will be _v${param_idx}
	var named_params = [];
	for (var i=0; i<info.params.length; i++) {
		var param = info.params[i];
		var cvar = `_v${i}`;
		named_params.push(gen_named_param(
			param.kind, param.type, cvar));
		param.cvar = cvar;
	}
	named_params = named_params.join(", ");

	var writes = [];
	var reads = [];
	var free_reads = '';

	if (typeof scheme.input !== "number") {
		for (var param_idx of scheme.input) {
			gen_write(info.params[param_idx], writes);
		}
		writes = writes.join("\n\t");
	} else {
		writes = gen_write_stream(info.params[scheme.input]);
	}

	if (typeof scheme.output !== "number") {
		reads.push('const char **lines = parse_fd_lines(pout);');
		if (scheme.output !== undefined) {
			for (var line_num = 0; line_num < scheme.output.length;
					line_num++) {
				var param_idx = scheme.output[line_num];
				reads.push(gen_read(info.params[param_idx], line_num));
			}
		}

		for (var param of info.params) {
			if (param.kind === 'output' && param.format === 'path') {
				reads.push(`// read output ${param.type} param from path`);
				reads.push(`sprintf(temp_path, "%s/arg_${param.cvar}", ` +
					`temp_dir);`);
				switch (param.type) {
					case 'int32':
					case 'real64':
					case 'string':
						reads.push(`read_path_${param.type}(temp_path, ` +
							`&${param.cvar});`);
						break;
					case 'blob':
						reads.push(`read_path_blob(temp_path, ` +
							`${param.cvar}, ${param.cvar}_size);`);
						break;
					default:
						nimpl(param);
				}
			}
		}

		reads = reads.join("\n\t");
		free_reads = `free(lines);`;
	} else {
		reads = gen_read_stream(info.params[scheme.output]);
	}

	if (info.exec_args !== undefined && info.exec_args.length > 0)
		nimpl(info);
	if (!('.dir' in info) || info.executable === undefined)
		nimpl(info);
	var xpath = path.join(info['.dir'], info.executable);

	var res = `\
// Generated in generate_cpf_clif_wrapper.js
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

#include "clif.h"

void pipe_exec(const char *, int *, int *);
const char **parse_fd_lines(int fd);

void ${c_func_name}(${named_params}) {
	int pin, pout;
	const char *temp_dir = create_temp_dir();
	char temp_path[1024];

	pipe_exec("${xpath}", &pin, &pout);

	// write to stdin
	${writes}

	close(pin);

	// read from stdout
	${reads}

	delete_temp_dir(temp_dir);

	${free_reads}
	close(pout);
}

`;
	return res;
}

module.exports = generate_cpf_clif_wrapper;
