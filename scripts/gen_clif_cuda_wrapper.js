#!/usr/bin/env node

/*
CLIF
	in path frag     -- directory of a cuef or cukf code fragment
	in path clif     -- directory for the generated CLIF code fragment
	in string mode   -- "gpu" (default) or "emulate" (cuef only)

Generates a CLIF wrapper over a CUDA code fragment:

cuef ("CUDA Element Format"): a __device__ function that computes one
	element of the result, see examples/24_cuef_vadd/readme.md. The wrapper
	contains a kernel that calls this function, one thread per element.
cukf ("CUDA Kernel Format"): a __global__ kernel written by the user, see
	examples/26_cukf_sum/readme.md. The wrapper launches this kernel.

In both cases the wrapper reads the inputs, copies them to the GPU, launches
the kernel, checks for errors, copies the outputs back and writes them.

mode "gpu": code.cu for nvcc.
mode "emulate" (cuef only): code.cpp for an ordinary C++ compiler. It calls
	the cuef function in a loop on the CPU, so no GPU is needed.
*/

const fs = require('fs');
const path = require('path');

const { build_clif_params_scheme, ensure_dir_exists } =
	require("../src/code_helpers.js");
const { abort } = require("../src/common.js");

// Parameter formats. As in cpf and clif, the format says how a value is
// passed to the code, and the type is the type of the value. An array
// format is a blob whose bytes are elements of the given C type: the
// element size is needed to count the elements (threads) and to allocate
// the outputs before the kernel starts.
const FORMATS = {
	int32:        { type: 'int32',  ctype: 'int32_t', array: false },
	real64:       { type: 'real64', ctype: 'double',  array: false },
	int32_array:  { type: 'blob',   ctype: 'int32_t', array: true },
	real64_array: { type: 'blob',   ctype: 'double',  array: true }
};

const MODES = ['gpu', 'emulate'];

const DEFAULT_BLOCK_SIZE = 256;
const MAX_BLOCK_SIZE = 1024;

function has(obj, key) {
	return Object.prototype.hasOwnProperty.call(obj, key);
}

// format description of a parameter (checked by check_manifest)
function fmt(param) {
	return FORMATS[param.format];
}

function get_sources(mf) {
	if (typeof mf.src === 'string')
		return [mf.src];
	if (Array.isArray(mf.src))
		return mf.src;
	return [];
}

// Checks that 'idx' is an input parameter which can define a number of
// elements: an array (its number of elements) or an int32 (its value).
function check_count_source(mf, what, idx) {
	var where = `${mf.format} ${mf.func_name}: ${what}`;
	if (!Number.isInteger(idx) || idx < 0 || idx >= mf.params.length)
		abort(`${where} must be a parameter index`, idx);
	var param = mf.params[idx];
	if (param.kind !== 'input' || !has(FORMATS, param.format) ||
			(!fmt(param).array && param.format !== 'int32'))
		abort(`${where} must point to an input array or int32 parameter`,
			idx);
}

function check_manifest(mf, mode) {
	if (mf.format !== 'cuef' && mf.format !== 'cukf')
		abort("not a CUDA code fragment (expected format cuef or cukf)",
			mf.format);
	var cukf = (mf.format === 'cukf');
	if (typeof mf.func_name !== 'string' ||
			!/^[A-Za-z_][A-Za-z0-9_]*$/.test(mf.func_name))
		abort(`${mf.format}: func_name must be a C identifier`,
			mf.func_name);
	var name = `${mf.format} ${mf.func_name}`;
	if (cukf && mode !== 'gpu')
		abort(`${name}: cukf fragments run only on the GPU ` +
			`(mode "${mode}" is not supported)`);
	if (!Array.isArray(mf.params) || mf.params.length === 0)
		abort(`${name}: params must be a non-empty list`);

	var outputs = 0;
	mf.params.forEach((param, idx) => {
		var where = `${name}: parameter ${idx}`;
		if (has(param, 'elem'))
			abort(`${where}: "elem" is no longer used, the element type ` +
				`is given by the format (int32_array or real64_array)`);
		if (!has(FORMATS, param.format))
			abort(`${where}: format must be one of ` +
				Object.keys(FORMATS).join(', '), param.format);
		if (param.type !== fmt(param).type)
			abort(`${where}: format ${param.format} needs type ` +
				`${fmt(param).type}`, param.type);

		if (param.kind === 'output') {
			outputs++;
			if (fmt(param).array) {
				check_count_source(mf, `parameter ${idx}: size_from`,
					param.size_from);
			} else if (!cukf) {
				abort(`${where}: outputs must be arrays ` +
					`(int32_array or real64_array)`);
			} else if (has(param, 'size_from')) {
				abort(`${where}: size_from is only for output arrays`);
			}
		} else if (param.kind !== 'input') {
			abort(`${where}: unknown kind`, param.kind);
		}
	});
	if (outputs === 0)
		abort(`${name}: at least one output is required`);

	check_count_source(mf, 'threads_from', mf.threads_from);

	if (has(mf, 'block_size')) {
		if (!cukf)
			abort(`${name}: block_size is only for cukf fragments`);
		if (!Number.isInteger(mf.block_size) || mf.block_size < 1 ||
				mf.block_size > MAX_BLOCK_SIZE)
			abort(`${name}: block_size must be an integer from 1 to ` +
				`${MAX_BLOCK_SIZE}`, mf.block_size);
	}

	var sources = get_sources(mf);
	if (sources.length === 0 || sources.some(s => typeof s !== 'string'))
		abort(`${name}: src must be a file name or a list of file names`);
}

// C expression for the number of elements defined by parameter 'idx'
function count_of(mf, idx) {
	return fmt(mf.params[idx]).array ? `_n${idx}` : `_v${idx}`;
}

function gen_wrapper(mf, mode, frag_dir, stdin_idx) {
	var name = mf.func_name;
	var cukf = (mf.format === 'cukf');
	var what = `${mf.format} ${name}`; // prefix of error messages
	var gpu = (mode === 'gpu');
	var params = mf.params;
	var out = [];

	// indices of array parameters (of the given kind, if any)
	function arrays(kind) {
		var res = [];
		params.forEach((p, idx) => {
			if (fmt(p).array && (kind === undefined || p.kind === kind))
				res.push(idx);
		});
		return res;
	}

	// indices of output numbers (cukf only)
	function scalar_outputs() {
		var res = [];
		params.forEach((p, idx) => {
			if (!fmt(p).array && p.kind === 'output')
				res.push(idx);
		});
		return res;
	}

	// C type of a kernel parameter for parameter 'p'
	function kernel_ctype(p) {
		if (p.kind === 'output')
			return `${fmt(p).ctype} *`;
		if (fmt(p).array)
			return `const ${fmt(p).ctype} *`;
		return fmt(p).ctype;
	}

	function elem_ctype(idx) {
		return fmt(params[idx]).ctype;
	}

	// parameters which define numbers of elements (threads, output sizes)
	var count_sources = [mf.threads_from];
	arrays('output').forEach(idx => count_sources.push(params[idx].size_from));
	count_sources = count_sources.filter((idx, k) =>
		count_sources.indexOf(idx) === k);

	// --- header ---
	out.push(`// Generated by scripts/gen_clif_cuda_wrapper.js ` +
		`(format: ${mf.format}, mode: ${mode}).`);
	out.push(`// CLIF wrapper over the ${mf.format} code fragment "${name}".`);
	out.push(`#include <math.h>`);
	out.push(`#include <stddef.h>`);
	out.push(`#include <stdint.h>`);
	out.push(`#include <stdio.h>`);
	out.push(`#include <stdlib.h>`);
	out.push(`extern "C" {`);
	out.push(`#include "clif.h"`);
	out.push(`}`);
	out.push(``);
	if (!gpu) {
		out.push(`// Emulation on the CPU: remove the CUDA qualifiers.`);
		out.push(`#define __device__`);
		out.push(`#define __host__`);
		out.push(`#define __forceinline__ inline`);
		out.push(``);
	}
	if (cukf) {
		out.push(`// threads per block (manifest field block_size)`);
		out.push(`#define CUKF_BLOCK_SIZE ` +
			`${mf.block_size || DEFAULT_BLOCK_SIZE}`);
		out.push(``);
	}
	out.push(`// The user code`);
	get_sources(mf).forEach(src => {
		out.push(`#include ${JSON.stringify(path.resolve(frag_dir, src))}`);
	});
	out.push(``);
	out.push(`static void _wrap_fail(const char *what) {`);
	out.push(`\tfprintf(stderr, "${what}: %s\\n", what);`);
	out.push(`\texit(1);`);
	out.push(`}`);
	out.push(``);

	if (gpu) {
		out.push(String.raw`#define _WRAP_CHECK(call) do { \
	cudaError_t _err = (call); \
	if (_err != cudaSuccess) { \
		fprintf(stderr, "${what}: %s: %s\n", #call, \
			cudaGetErrorString(_err)); \
		exit(1); \
	} \
} while (0)`);
		out.push(``);
	}

	if (gpu && !cukf) {
		// cuef kernel: one thread per element. The index is computed in
		// 64 bits: for n close to 2^31 the last block has threads with
		// numbers that do not fit into int.
		var kparams = ['int n'];
		var kargs = [];
		params.forEach((p, idx) => {
			var t = kernel_ctype(p);
			kparams.push(t.endsWith('*') ? `${t}_p${idx}` : `${t} _p${idx}`);
			kargs.push(`_p${idx}`);
		});
		out.push(`__global__ void _cuef_kernel(${kparams.join(', ')}) {`);
		out.push(`\tlong long i = (long long)blockIdx.x * blockDim.x + ` +
			`threadIdx.x;`);
		out.push(`\tif (i < n)`);
		out.push(`\t\t${name}((int)i, n, ${kargs.join(', ')});`);
		out.push(`}`);
		out.push(``);
	}

	out.push(`int main() {`);
	out.push(`\tconst char **stdin_lines = parse_stdin_lines();`);
	out.push(``);

	// --- read inputs ---
	out.push(`\t// read inputs`);
	params.forEach((p, idx) => {
		if (p.kind !== 'input')
			return;
		var line = `stdin_lines[${stdin_idx[idx]}]`;
		if (!fmt(p).array) {
			out.push(`\t${fmt(p).ctype} _v${idx} = parse_${p.format}(${line});`);
			return;
		}
		var et = elem_ctype(idx);
		out.push(`\tvoid *_v${idx};`);
		out.push(`\tsize_t _v${idx}_size;`);
		out.push(`\tread_path_blob(${line}, &_v${idx}, &_v${idx}_size);`);
		out.push(`\tif (_v${idx}_size % sizeof(${et}) != 0)`);
		out.push(`\t\t_wrap_fail("parameter ${idx}: the array size is ` +
			`not a multiple of the element size");`);
		if (count_sources.indexOf(idx) !== -1)
			out.push(`\tsize_t _n${idx} = _v${idx}_size / sizeof(${et});`);
	});
	out.push(``);

	// --- numbers of elements given by int32 parameters ---
	count_sources.forEach(idx => {
		if (params[idx].format !== 'int32')
			return;
		out.push(`\tif (_v${idx} < 0)`);
		out.push(`\t\t_wrap_fail("parameter ${idx}: the number of ` +
			`elements is negative");`);
	});

	// --- number of threads ---
	out.push(`\t// number of elements (threads)`);
	out.push(`\tsize_t _n = (size_t)${count_of(mf, mf.threads_from)};`);
	out.push(`\tif (_n > 2147483647u)`);
	out.push(`\t\t_wrap_fail("too many elements");`);
	out.push(`\tint n = (int)_n;`);
	out.push(``);

	// --- allocate outputs (filled with zeros) ---
	out.push(`\t// allocate outputs`);
	arrays('output').forEach(idx => {
		var et = elem_ctype(idx);
		out.push(`\tsize_t _n${idx} = (size_t)` +
			`${count_of(mf, params[idx].size_from)};`);
		out.push(`\tsize_t _v${idx}_size = _n${idx} * sizeof(${et});`);
		out.push(`\tvoid *_v${idx} = calloc(_n${idx} ? _n${idx} : 1, ` +
			`sizeof(${et}));`);
		out.push(`\tif (_v${idx} == NULL)`);
		out.push(`\t\t_wrap_fail("out of memory");`);
	});
	scalar_outputs().forEach(idx => {
		out.push(`\t${elem_ctype(idx)} _v${idx} = 0;`);
	});
	out.push(``);

	if (gpu) {
		out.push(`\t// copy inputs to the GPU, allocate outputs there`);
		arrays().forEach(idx => {
			var et = elem_ctype(idx);
			var size = `_v${idx}_size`;
			out.push(`\t${et} *_d${idx};`);
			out.push(`\t_WRAP_CHECK(cudaMalloc((void **)&_d${idx}, ` +
				`${size} ? ${size} : 1));`);
			if (params[idx].kind === 'input')
				out.push(`\t_WRAP_CHECK(cudaMemcpy(_d${idx}, _v${idx}, ` +
					`${size}, cudaMemcpyHostToDevice));`);
			else
				out.push(`\t_WRAP_CHECK(cudaMemset(_d${idx}, 0, ${size}));`);
		});
		scalar_outputs().forEach(idx => {
			var et = elem_ctype(idx);
			out.push(`\t${et} *_d${idx};`);
			out.push(`\t_WRAP_CHECK(cudaMalloc((void **)&_d${idx}, ` +
				`sizeof(${et})));`);
			out.push(`\t_WRAP_CHECK(cudaMemset(_d${idx}, 0, ` +
				`sizeof(${et})));`);
		});
		out.push(``);

		// arrays and output numbers are in GPU memory, input numbers are
		// passed by value
		var args = params.map((p, idx) =>
			(fmt(p).array || p.kind === 'output') ? `_d${idx}` : `_v${idx}`);
		var kernel, block;
		if (cukf) {
			out.push(`\t// the kernel must have exactly the signature ` +
				`given by the manifest`);
			var sig = ['int'].concat(params.map(p => kernel_ctype(p).trim()));
			out.push(`\tvoid (*_signature)(${sig.join(', ')}) = ${name};`);
			out.push(`\t(void)_signature;`);
			out.push(``);
			out.push(`\t// launch the kernel`);
			kernel = name;
			block = 'CUKF_BLOCK_SIZE';
		} else {
			out.push(`\t// run one thread per element`);
			kernel = '_cuef_kernel';
			block = `${DEFAULT_BLOCK_SIZE}`;
		}
		out.push(`\tif (n > 0) {`);
		out.push(`\t\tint _block = ${block};`);
		out.push(`\t\tint _grid = (int)(((long long)n + _block - 1) / _block);`);
		out.push(`\t\t${kernel}<<<_grid, _block>>>(n, ${args.join(', ')});`);
		out.push(`\t\t_WRAP_CHECK(cudaGetLastError());`);
		out.push(`\t\t_WRAP_CHECK(cudaDeviceSynchronize());`);
		out.push(`\t}`);
		out.push(``);

		out.push(`\t// copy outputs back, free GPU memory`);
		arrays('output').forEach(idx => {
			out.push(`\t_WRAP_CHECK(cudaMemcpy(_v${idx}, _d${idx}, ` +
				`_v${idx}_size, cudaMemcpyDeviceToHost));`);
		});
		scalar_outputs().forEach(idx => {
			out.push(`\t_WRAP_CHECK(cudaMemcpy(&_v${idx}, _d${idx}, ` +
				`sizeof(${elem_ctype(idx)}), cudaMemcpyDeviceToHost));`);
		});
		arrays().concat(scalar_outputs()).forEach(idx => {
			out.push(`\t_WRAP_CHECK(cudaFree(_d${idx}));`);
		});
	} else {
		var args = params.map((p, idx) => {
			if (!fmt(p).array)
				return `_v${idx}`;
			var et = elem_ctype(idx);
			return p.kind === 'input' ? `(const ${et} *)_v${idx}`
				: `(${et} *)_v${idx}`;
		});
		out.push(`\t// emulation: call the function for each element in turn`);
		out.push(`\tfor (int i = 0; i < n; i++)`);
		out.push(`\t\t${name}(i, n, ${args.join(', ')});`);
	}
	out.push(``);

	// --- write outputs, free memory ---
	// arrays go to files; numbers go to stdout, one line each, in the
	// order of the parameters
	out.push(`\t// write outputs`);
	params.forEach((p, idx) => {
		if (p.kind !== 'output')
			return;
		if (fmt(p).array)
			out.push(`\twrite_path_blob(stdin_lines[${stdin_idx[idx]}], ` +
				`_v${idx}, _v${idx}_size);`);
		else
			out.push(`\twrite_line_${p.format}(_v${idx});`);
	});
	out.push(``);
	arrays().forEach(idx => out.push(`\tfree(_v${idx});`));
	out.push(`\tfree((void *)stdin_lines[0]);`);
	out.push(`\tfree((void *)stdin_lines);`);
	out.push(`\treturn 0;`);
	out.push(`}`);
	out.push(``);

	return out.join('\n');
}

// --- main ---

var lines = fs.readFileSync(0, "utf-8").split('\n');
if (!lines[0] || !lines[1])
	abort("usage: printf 'FRAG_DIR\\nOUT_DIR\\n[gpu|emulate]\\n' | " +
		"node gen_clif_cuda_wrapper.js");
var frag_dir = path.resolve(lines[0]);
var clif_dir = lines[1];
var mode = lines[2] || 'gpu';
if (MODES.indexOf(mode) === -1)
	abort("unknown mode (expected gpu or emulate)", mode);

var mf = JSON.parse(fs.readFileSync(path.join(frag_dir, 'manifest.json')));
check_manifest(mf, mode);

// The CLIF wrapper takes input numbers as stdin lines, arrays (inputs and
// outputs) as paths to files in stdin lines, and writes output numbers to
// stdout.
var clif_mf = {
	type: 'codefrag',
	format: 'clif',
	params: mf.params.map(p => ({
		kind: p.kind,
		type: p.type,
		format: fmt(p).array ? 'path' : 'string'
	})),
	src: mode === 'gpu' ? 'code.cu' : 'code.cpp'
};

var scheme = build_clif_params_scheme(clif_mf.params);
var stdin_idx = {};
(scheme.input || []).forEach((param_idx, line_idx) => {
	stdin_idx[param_idx] = line_idx;
});
mf.params.forEach((p, idx) => {
	if ((p.kind === 'input' || fmt(p).array) && !has(stdin_idx, idx))
		abort(`${mf.format} ${mf.func_name}: parameter ${idx} has no ` +
			`stdin line`);
});

var code = gen_wrapper(mf, mode, frag_dir, stdin_idx);

ensure_dir_exists(clif_dir);
fs.writeFileSync(path.join(clif_dir, clif_mf.src), code, 'utf-8');
fs.writeFileSync(path.join(clif_dir, 'manifest.json'),
	JSON.stringify(clif_mf, null, 2), 'utf-8');
