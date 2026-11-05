const assert = require('assert');
const fs = require('fs');

const { abort, nimpl } = require("../src/common.js");

const TABLE = {
	'int32': 'int',
	'int64': 'long long',
	'real32': 'float',
	'real64': 'double'
};

/*
This function builds stdin/stdout usage scheme for clif params.
{
	input: <param_idx> // for stream format, or:
	input: [<param_idx>...] // for non-stream format
	output: <param_idx> // for stream format, or:
	output: [<param_idx>...] // for non-stream format
}
*/
function build_clif_params_scheme(params) {
	var scheme = {};
	function set(field, param_idx) {
		assert(scheme[field] === undefined);
		scheme[field] = param_idx;
	}

	function push(field, param_idx) {
		if (scheme[field] === undefined)
			scheme[field] = [];
		assert(typeof scheme[field] === 'object');
		scheme[field].push(param_idx);
	}

	for (var param_idx=0; param_idx<params.length; param_idx++) {
		var param = params[param_idx];
		assert(is_valid_clif_format(param.format));

		switch (param.kind) {
			case 'input':
				switch (param.format) {
					case 'path':
					case 'string':
						push('input', param_idx);
						break;
					case 'stdin':
						set('input', param_idx);
						break;
					default: nimpl(param);
				}
				break;
			case 'output':
				switch (param.format) {
					case 'path':
						push('input', param_idx);
						break;
					case 'string':
						push('output', param_idx);
						break;
					case 'stdout':
						set('output', param_idx);
						break;
					default:
						nimpl(param);
				}
				break;
			default:
				abort(param, param_idx);
		}
	}

	return scheme;
}

function is_no_streams_scheme(scheme) {
	return typeof scheme.input !== "number" &&
		typeof scheme.output !== "number";
}

/*
function build_params_scheme_old(params) {
	var res = {};

	function ensure_mode(io, mode) {
		assert(io === 'in' || io === 'out');
		assert(mode === 'lines' || mode === 'stream');
		var key = `${io}_mode`;
		assert(res[key] === undefined || res[key] === mode);
		if (res[key] === undefined && mode === 'lines')
			res[`${io}put`] = [];
		res[key] = mode;
	}

	// Fill in reads and writes
	for (var i=0; i<params.length; i++) {
		var param = params[i];
		assert((param.kind === 'input' || param.kind === 'output')
			&& param.format !== undefined
			&& param.type !== undefined);
		assert(is_valid_clif_format(param.format));
		if (param.kind === 'input') {
			if (param.format === 'stream') {
				ensure_mode('in', 'stream');
				res.input = {
				}
			}
				
			switch (param.format) {
				case 'string':
				case 'path'
				case 'int32':
				case 'real64':
					ensure_mode('in', 'lines');
					assert(param.format === get_var_format(param.target));
					res.input.push({
						kind: 'value',
						target: param.target,
						format: param.format,
						param_idx: i,
						param_info: param
					});
					break;
				case 'blob':
					ensure_mode('in', 'lines');
					res.input.push({
						kind: 'read_path',
						target: param.target,
						format: get_var_format(param.target),
						param_idx: i,
						param_info: param
					});
					break;
				case 'stdin':
					ensure_mode('in', 'stream');
					res.input = {
						target: param.target,
						format: get_var_format(param.target),
						param_idx: i,
						param_info: param
					}
					break;
				default:
					nimpl(param);
			}
		} else if (param.kind === 'output') {
			switch (param.format) {
				case 'int32':
				case 'real64':
				case 'string':
					ensure_mode('out', 'lines');
					assert(param.format === get_var_format(param.source));
					res.output.push({
						kind: 'value',
						source: param.source,
						format: param.format,
						param_idx: i,
						param_info: param
					});
					break;
				case 'blob':
					ensure_mode('in', 'lines');
					res.input.push({
						kind: 'write_path',
						source: param.source,
						format: get_var_format(param.source),
						param_idx: i,
						param_info: param
					});
					break;
				case 'path':
					nimpl("recheck");
				case 'stdout':
					nimpl("recheck");
					ensure_mode('out', 'stream');
					res.output = {
						source: param.source,
						format: get_var_format(param.source),
						param_idx: i,
						param_info: param
					};
					break;
				default:
					nimpl(param);
			}
		} else
			nimpl(param);
	}

	return res;
}
*/

function ensure_dir_exists(dir_path) {
	if (fs.existsSync(dir_path)) {
		if (fs.readdirSync(dir_path).length > 0)
			abort("target dir not empty", dir_path);
	} else {
		fs.mkdirSync(dir_path);
	}
}

function gen_decl(format, cvar) {
	if (format in TABLE)
		return `${TABLE[format]} ${cvar}`;
	else if (format === 'blob' || format === 'path')
		return `void *${cvar}; size_t ${cvar}_size`;
	else if (format === 'string')
		return `char *${cvar}`;
	else
		nimpl(format, cvar);
}


function to_ctype(format) {
	if (!(format in TABLE))
		nimpl(format);

	return TABLE[format];
}

function to_input_c_param(param, cvar) {
	if (cvar === undefined)
		cvar = '';
	if (param.format !== param.type)
		nimpl(param);

	switch (param.format) {
		case 'int32':
		case 'real64':
			return `${to_ctype(param.format)} ${cvar}`.trim();
		case 'blob':
			if (cvar !== '')
				return `const void *${cvar}, size_t ${cvar}_size`;
			else
				return `const void *, size_t`;
		case 'string':
			if (cvar !== '')
				return `const char *${cvar}`;
			else
				return `const char *`;
		default:
			nimpl(param);
	}
}

function to_output_c_param(param, cvar) {
	if (cvar === undefined)
		cvar = '';
	if (param.format !== param.type)
		nimpl(param);

	switch (param.format) {
		case 'int32':
		case 'real64':
			return `${to_ctype(param.format)} *${cvar}`.trim();
		case 'blob':
			if (cvar !== '')
				return `void **${cvar}, size_t *${cvar}_size`
			else
				return `void **, size_t *`;
		case 'string':
			return `char **${cvar}`;
		default:
			nimpl(param);
	}
}
function gen_signature(code) {
	var params = code.params.map(param => {
		switch (param.kind) {
			case 'input':
				return to_input_c_param(param);
			case 'output':
				return to_output_c_param(param);
			default:
				nimpl(param);
		}
	});
	return `void ${code.c_func_name}(${params.join(", ")})`;
}

function is_valid_clif_format(format) {
	return ['stdin', 'stdout', 'string', 'path'].indexOf(format) !== -1;
}

module.exports = {
	build_clif_params_scheme,
	is_no_streams_scheme,
	ensure_dir_exists,
	gen_decl,
	gen_signature,
	to_ctype,
	to_input_c_param,
	to_output_c_param
};
