// Generate C code with main, that implements jaz with clif interface
const assert = require('assert');

const { abort, get_single_locator, nimpl, traverse }
	= require("./common.js");
const { deduce_var_info } = require("./gen_common.js");

// TODO: ensure this is always called with type, not format
function to_ctype(type) {
	var table = {
		'int32': 'int',
		'int64': 'long long',
		'real32': 'float',
		'real64': 'double',
		'string': 'const char *'
	};

	if (!(type in table))
		nimpl(type);

	return table[type];
}

function to_default_c_format(type) {
	switch (type) {
		case 'int32':
		case 'real64':
		case 'string':
		case 'blob':
			return type;
		default:
			nimpl(type);
	}
}

function allocate_vars(vars) {
	var next_cvar_id = 0;
	for (var ref in vars) {
		var info = vars[ref];

		switch (info.type) {
			case 'int32':
			case 'real64':
				info.cvar = `_v${next_cvar_id++}`;
				var ctype = to_ctype(to_default_c_format(info.type));
				info.decl = `${ctype} ${info.cvar};` +
					` // ${info.type} ${ref}`;
				break;
			case 'blob':
				info.data_cvar = `_v${next_cvar_id++}`;
				info.size_cvar = info.data_cvar + '_size';
				info.decl = `void *${info.data_cvar};` +
					`size_t ${info.size_cvar}; ` +
					`// ${info.type} ${ref}`;
				break;
			case 'string':
				info.cvar = `_v${next_cvar_id++}`;
				info.decl = `char * ${info.cvar};` +
					` // ${info.type} ${ref}`;
				break;
			default:
				nimpl(info);
		}
	}
}

function is_primitive_type(type) {
	return type === 'int32' || type === 'real64' ||
		type === 'string';
}

function gen_read_path(target, index) {
	if (target === undefined)
		nimpl(...arguments);
	var format = to_default_c_format(target.type);
	return `read_path_${format}(stdin_line[${index}], ${
		as_output(target)});`;
}

function gen_read_stdin(target) {
	var format = to_default_c_format(target.type);
	return `read_stdin_${format}(${as_output(target)});`;
}

function gen_read_line(var_info, iface_type, index) {
	if (!is_primitive_type(iface_type))
		nimpl(...arguments);

	assert(iface_type === var_info.type);

	return `${var_info.cvar} = parse_${iface_type}(stdin_line[${index}]);`;
}

function gen_write_line(var_info, iface_type, index) {
	if (!is_primitive_type(iface_type))
		nimpl(...arguments);

	assert(iface_type === var_info.type);
	return `write_line_${iface_type}(${var_info.cvar});`;
}

function gen_write_path(var_info, index, stdin_index) {
	return `write_path_${var_info.type}(stdin_line[${stdin_index}], ${
		as_input(var_info)});`;
}

function gen_write_stdout(source) {
	var format = to_default_c_format(source.type);
	switch (format) {
		case 'int32':
			return `fwrite(&${source.cvar}, sizeof(${source.cvar}),` +
				` 1, stdout); // ${source.format} ${source.ref} => stdout`;
			return `printf("%d\\n", ${source.cvar});`;
		case 'string':
			return `fwrite(${source.cvar}, strlen(${source.cvar}), ` +
				`1, stdout); // ${source.format} ${source.ref} => stdout`;
		case 'blob':
			return `fwrite(${source.data_cvar}, ` +
				`${source.size_cvar}, ` +
				`1, stdout); // ${source.type} ` +
				`${source.name} => stdout`;
		default:
			nimpl(source);
	}
	nimpl(source);
}

function ensure_mode(cur_mode, new_mode) {
	if (cur_mode !== undefined)
		assert(cur_mode === new_mode);

	return new_mode;
}

// parse clif params and make readers/writers into default C formats
function parse_params(iface_params, vars) {
	var next_stdin_idx = 0;
	var next_stdout_idx = 0;

	var in_mode = undefined;
	var out_mode = undefined;
	var reads = [];
	var writes = [];

	// Fill in reads and writes
	for (var param of iface_params) {
		if (param.format === 'string') {
			if (param.kind === 'input') {
				in_mode = ensure_mode(in_mode, 'lines');
				reads.push(gen_read_line(vars[param.target],
					param.type, next_stdin_idx++));
			} else {
				assert(param.kind === 'output');
				out_mode = ensure_mode(out_mode, 'lines');
				writes.push(gen_write_line(vars[param.source],
					param.type, next_stdout_idx++));
			}
		} else if (param.format === 'path') {
			in_mode = ensure_mode(in_mode, 'lines');
			if (param.kind === 'input') {
				if (!(param.target in vars))
					abort(vars, param);
				reads.push(gen_read_path(vars[param.target],
					next_stdin_idx++));
			} else {
				writes.push(gen_write_path(vars[param.source],
					next_stdout_idx++, next_stdin_idx++));
			}
		} else if (param.format === 'stdin') {
			in_mode = ensure_mode(in_mode, 'stream');
			assert(param.kind === 'input');
			reads.push(gen_read_stdin(vars[param.target]));
		} else if (param.format === 'stdout') {
			out_mode = ensure_mode(out_mode, 'stream');
			writes.push(gen_write_stdout(vars[param.source]));
		} else
			nimpl(param);
	}

	return { reads, writes, in_mode, out_mode };
}

function as_input(v) {
	switch (v.type) {
		case 'int32':
		case 'int64':
		case 'real32':
		case 'real64':
		case 'string':
			return v.cvar;
		case 'blob':
			return `${v.data_cvar}, ${v.size_cvar}`;
		default:
			nimpl(v);
	}
}

function as_output(v) {
	switch (v.type) {
		case 'int32':
		case 'int64':
		case 'real32':
		case 'real64':
		case 'string':
			return `&${v.cvar}`;
		case 'blob':
			return `&${v.data_cvar}, &${v.size_cvar}`;
		default:
			nimpl(v);
	}
}

function gen_cpf_invoke(op, code, vars) {
	var args = [];
	for (var i=0; i<op.args.length; i++) {
		if (typeof op.args[i] === 'number') {
			args.push(op.args[i]);
			continue;
		}
		if (typeof op.args[i] !== 'string')
			nimpl(op.args[i]);

		var v = vars[op.args[i]];
		var param = code.params[i];
		assert(v.type === param.type);
		switch (param.kind) {
			case 'input':
				args.push(as_input(v));
				break;
			case 'output':
				args.push(as_output(v));
				break;
			default:
				nimpl(param);
		}
	}
	return `${code.c_func_name}(${args.join(", ")});`;
}

// TODO duplicate? see code_helpers
function gen_signature(code) {
	if (code.format !== 'cpf')
		abort(code);

	var params = [];

	for (var param of code.params) {
		switch(param.kind) {
			case 'input':
				switch (param.type) {
					case 'int32':
					case 'real64':
					{
						var snip = `${to_ctype(param.format)}`;
						if (param.name)
							snip += ' ' + param.name;
						params.push(snip);
						break;
					}
					case 'blob':
						if (param.name)
							params.push(`const void * ${param.name}, ` +
								`size_t ${param.name}_size`);
						else
							params.push(`const void *, size_t`);
						break;
					case 'string':
						if (param.name)
							params.push('const char * ' + param.name);
						else
							params.push('const char *');
						break;
					default:
						nimpl(param);
				}
				break;
			case 'output':
				switch (param.type) {
					case 'int32':
					case 'real64':
						if (param.name)
							params.push(`${to_ctype(param.format)} * ` +
								param.name);
						else
							params.push(`${to_ctype(param.format)} *`);
						break;
					case 'blob':
						if (param.name)
							params.push(`void ** ${param.name}, ` +
								`size_t * ${param.name}_size`);
						else
							params.push(`void **, size_t *`);
						break;
					case 'string':
						if (param.name)
							params.push(`char ** ${param.name}`);
						else
							params.push('char **');
						break;
					default:
						nimpl(param);
				}
				break;
			default:
				nimpl(param);
		}
	}

	var signature = `void ${code.c_func_name}(${params.join(', ')})`;
	return signature;
}

function gen_clif_scheme(code) {
	return [];
}

var _auto_id = 0;
// returns code-like object, which is a CPF wrapper for CLIF code
function gen_cpf_clif_wrapper(op, code, vars) {
	assert(code.format === 'clif');
	var wid = `_wrapper_cpf_clif_${_auto_id++}`;

	var params = JSON.parse(JSON.stringify(code.params));

	for (var i=0; i<params.length; i++)
		params[i].name = `_param${i}`;

	var res = {
		type: 'codefrag',
		format: 'cpf',
		c_func_name: wid,
		params
	}

	var listing = gen_signature(res);

	var scheme = gen_clif_scheme(code);

	listing += ` {
    int stdin_pipe[2], stdout_pipe[2];
    pid_t pid;
    char* buffer = NULL;
    size_t total_bytes = 0;
	char **args = (char**)malloc(sizeof(char*));
	args[0] = NULL;

    // Создаём пайпы для stdin и stdout
    if (pipe(stdin_pipe)) return ;
    if (pipe(stdout_pipe)) {
        close(stdin_pipe[0]);
        close(stdin_pipe[1]);
        return ;
    }

    // Создаём дочерний процесс
    if ((pid = fork()) == -1) {
        close(stdin_pipe[0]);
        close(stdin_pipe[1]);
        close(stdout_pipe[0]);
        close(stdout_pipe[1]);
        return ;
    }

    if (pid == 0) { // Дочерний процесс
        // Перенаправляем стандартные потоки
        dup2(stdin_pipe[0], STDIN_FILENO);
        dup2(stdout_pipe[1], STDOUT_FILENO);

        // Закрываем ненужные дескрипторы
        close(stdin_pipe[0]);
        close(stdin_pipe[1]);
        close(stdout_pipe[0]);
        close(stdout_pipe[1]);

        // Запускаем целевую программу
        execvp("${code.c_func_name}", args);
        perror("execvp");
        exit(EXIT_FAILURE);
    } else { // Родительский процесс
        // Закрываем ненужные концы пайпов
        close(stdin_pipe[0]);
        close(stdout_pipe[1]);

        // Записываем входные данные`;

	// Now let's write to stdin
	// size_t written = write(stdin_pipe[1], input_str, strlen(input_str));

	listing += `
        close(stdin_pipe[1]);

        // Читаем вывод
        char tmp[4096];
        ssize_t bytes_read;
        while ((bytes_read = read(stdout_pipe[0], tmp, sizeof(tmp)))) {
            if (bytes_read < 0) {
                close(stdout_pipe[0]);
                waitpid(pid, NULL, 0);
                free(buffer);
                return ;
            }
            
            char* new_buf = realloc(buffer, total_bytes + bytes_read + 1);
            if (!new_buf) {
                close(stdout_pipe[0]);
                waitpid(pid, NULL, 0);
                free(buffer);
                return ;
            }
            
            buffer = new_buf;
            memcpy(buffer + total_bytes, tmp, bytes_read);
            total_bytes += bytes_read;
        }
        
        if (buffer)
            buffer[total_bytes] = '\\0';
        
        close(stdout_pipe[0]);
        waitpid(pid, NULL, 0);
	}`;
	// Now parse stdout

	listing += `
	}`;

	res.listing = listing;
	return res;
}

function gen_invokes(plan, cm, jaz, vars) {
	var invokes = [];
	var signatures = {};
	var listings = {};

	for (var opid of plan) {
		var op = cm.ops[opid];

		var code = traverse(jaz, op.code);
		switch (code.format) {
			case 'cpf':
				invokes.push(gen_cpf_invoke(op, code, vars));
				signatures[op.code] = gen_signature(code);
				if (code.listing)
					listings[op.code] = code.listing;
				break;
			case 'clif':
			{
				var wrapper = gen_cpf_clif_wrapper(
					op, code, vars);
				invokes.push(gen_cpf_invoke(op, wrapper,
					vars));
				signatures[wrapper.code] = gen_signature(
					wrapper);
				listings[wrapper.code] =
					wrapper.listing;
				break;
			}
			default:
				nimpl(jaz, code, op.code);
		}
	}

	return { invokes, signatures, listings };
}

function gen_clif_c(jaz) {
	jaz = JSON.parse(jaz);
	var plan_loc = get_single_locator(jaz, 'plan');
	var plan = traverse(jaz, plan_loc);
	var iface = traverse(jaz, plan.iface);

	if (iface.format !== 'clif')
		nimpl(iface);

	var cm = traverse(jaz, iface.cm);

	var vars = deduce_var_info(jaz, cm, plan.plan);
	allocate_vars(vars);
	var { reads, writes, in_mode, out_mode } =
		parse_params(iface.params, vars);

	var { invokes, signatures, listings } =
		gen_invokes(plan.plan, cm, jaz, vars);

	return apply_template(signatures, vars, reads, invokes, writes,
		listings, in_mode, out_mode);
}

function apply_template(signatures, vars, reads, invokes, writes,
		listings_, in_mode, out_mode) {
	var code_signatures = [];
	for (var code_id in signatures)
		code_signatures.push(signatures[code_id] + ';');
	signatures = code_signatures.join('\n');

	var listings = [];
	for (var code_id in listings_)
		listings.push(listings_[code_id]);
	listings = listings.join('\n');

	var var_decls = [];
	for (var ref in vars) {
		var_decls.push(vars[ref].decl);
	}
	var_decls = var_decls.join('\n\t');
	var init_reads;
	var finalize_reads;
	if (in_mode === 'lines') {
		init_reads = 'const char **stdin_line = parse_stdin_lines();';
		finalize_reads = 'free(stdin_line);';
	} else if (in_mode === 'stream') {
		init_reads = '';
		finalize_reads = '';
	} else nimpl(in_mode);

	if (reads.join)
		reads = reads.join('\n\t');
	else {
		init_reads = '';
		finalize_reads = '';
	}

	invokes = invokes.join('\n\t');

	if (writes.join)
		writes = writes.join('\n\t');

	return `\
// Generated by src/gen_clif.c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <unistd.h>
#include <sys/wait.h>

#include "clif.h"

void on_input_int32(const char *name, int value) {}
void on_input_real64(const char *name, double value) {}
void on_input_string(const char *name, const char *value, size_t length) {}
void on_input_blob(const char *name, const void *data, size_t size) {}
void write_outputs() {}
void init_dclif_ops() {}


${signatures}

${listings}

int main() {
	${init_reads}
	${var_decls}

	${reads}

	${invokes}

	${writes}

	${finalize_reads}
	return 0;
}
// End by src/gen_clif_c.js
`;}

module.exports = {
	gen_clif_c_async: (input, cb) => { cb(gen_clif_c(input)); },
	gen_clif_c
};
