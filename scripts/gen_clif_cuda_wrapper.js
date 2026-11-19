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

To inspect the generated wrapper from the command line:
	node scripts/gen_clif_cuda_wrapper.js FRAG_DIR OUT_DIR [--mode gpu|emulate]
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

function check_manifest(mf, mode) {
	if (!mf || typeof mf !== 'object' || Array.isArray(mf))
		abort("the CUDA fragment manifest must be an object");
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
	const fields = ['type', 'format', 'func_name', 'params', 'src',
		cukf ? 'launch' : 'work_size'];
	for (const key of Object.keys(mf)) {
		if (!fields.includes(key))
			abort(`${name}: unknown manifest field`, key);
	}
	if (!Array.isArray(mf.params) || mf.params.length === 0)
		abort(`${name}: params must be a non-empty list`);

	const count_sources = new Set();
	const array_sizes = [];

	function check_source(idx, field, allow_array = true) {
		if (!Number.isInteger(idx) || idx < 0 || idx >= mf.params.length)
			abort(`${name}: ${field} must reference a parameter index`, idx);
		const param = mf.params[idx];
		if (param?.kind !== 'input' ||
				(param.format !== 'int32' && !(allow_array && fmt(param)?.array))) {
			const type = allow_array ? 'an input array or int32' : 'an input int32';
			abort(`${name}: ${field} must reference ${type} parameter`, idx);
		}
		count_sources.add(idx);
	}

	function check_count(count, field, allow_array = true) {
		if (Number.isSafeInteger(count) && count >= 0)
			return;
		if (count && typeof count === 'object' &&
				Object.keys(count).length === 1 && has(count, 'param')) {
			check_source(count.param, field, allow_array);
			return;
		}
		abort(`${name}: ${field} must be a nonnegative integer or {"param": index}`,
			count);
	}

	var outputs = 0;
	mf.params.forEach((param, idx) => {
		const field = `parameter ${idx}`;
		const where = `${name}: ${field}`;
		if (!param || typeof param !== 'object')
			abort(`${where}: expected a parameter object`, param);
		if (has(param, 'elem'))
			abort(`${where}: "elem" is no longer used, the element type ` +
				`is given by the format (int32_array or real64_array)`);
		if (!has(FORMATS, param.format))
			abort(`${where}: format must be one of ` +
				Object.keys(FORMATS).join(', '), param.format);
		if (param.type !== fmt(param).type)
			abort(`${where}: format ${param.format} needs type ` +
				`${fmt(param).type}`, param.type);

		if (param.kind !== 'input' && param.kind !== 'output')
			abort(`${where}: unknown kind`, param.kind);
		const output = (param.kind === 'output');
		if (output)
			outputs++;
		const sizes = ['size', 'size_from', 'shape'].filter(key => has(param, key));
		if (!fmt(param).array) {
			if (sizes.length > 0)
				abort(`${where}: size, size_from and shape are for arrays`);
			if (output && !cukf)
				abort(`${where}: outputs must be arrays ` +
					`(int32_array or real64_array)`);
			return;
		}
		if (output && sizes.length !== 1)
			abort(`${where}: specify exactly one of size, size_from or shape`);
		if (!output && (has(param, 'size') || has(param, 'size_from')))
			abort(`${where}: use shape to declare the size of an input array`);

		if (has(param, 'shape')) {
			if (!Array.isArray(param.shape) || param.shape.length === 0)
				abort(`${where}: shape must be a non-empty list of dimensions`);
			param.shape.forEach((size, axis) =>
				check_count(size, `${field}: shape[${axis}]`, false));
			array_sizes[idx] = param.shape;
		} else if (has(param, 'size_from')) {
			check_source(param.size_from, `${field}: size_from`);
			array_sizes[idx] = [{ param: param.size_from }];
		} else if (has(param, 'size')) {
			if (!Number.isSafeInteger(param.size) || param.size < 0)
				abort(`${where}: size must be a nonnegative integer`, param.size);
			array_sizes[idx] = [param.size];
		}
	});
	if (outputs === 0)
		abort(`${name}: at least one output is required`);

	if (has(mf, 'work_size'))
		check_count(mf.work_size, 'work_size');

	let block = [DEFAULT_BLOCK_SIZE];
	let launch;
	if (cukf) {
		const config = mf.launch;
		if (!config || typeof config !== 'object' || Array.isArray(config))
			abort(`${name}: launch must specify the extent or grid of the kernel`);
		for (const key of Object.keys(config)) {
			if (!['extent', 'grid', 'block'].includes(key))
				abort(`${name}: unknown launch field`, key);
		}
		const fields = ['extent', 'grid'].filter(key => has(config, key));
		if (fields.length !== 1)
			abort(`${name}: launch must have exactly one of extent or grid`);
		const field = fields[0];
		const axes = config[field];
		if (!Array.isArray(axes) || axes.length < 1 || axes.length > 3)
			abort(`${name}: launch.${field} must contain 1 to 3 dimensions`);
		axes.forEach((value, axis) => check_count(value, `launch.${field}[${axis}]`));
		if (has(config, 'block') || axes.length !== 1)
			block = config.block;
		if (!Array.isArray(block) || block.length !== axes.length ||
				block.some(size => !Number.isInteger(size) || size < 1 ||
					size > MAX_BLOCK_SIZE) ||
				block.reduce((product, size) => product * size, 1) > MAX_BLOCK_SIZE)
			abort(`${name}: launch.block must have ${axes.length} positive dimensions ` +
				`and at most ${MAX_BLOCK_SIZE} threads in total`, block);
		launch = { axes, exact_grid: field === 'grid' };
	}

	const sources = get_sources(mf);
	if (sources.length === 0 || sources.some(s => typeof s !== 'string' || s === ''))
		abort(`${name}: src must be a file name or a list of file names`);
	return { count_sources, array_sizes, block, launch, sources };
}

function gen_wrapper(mf, layout, mode, frag_dir, stdin_idx) {
	var name = mf.func_name;
	var cukf = (mf.format === 'cukf');
	var what = `${mf.format} ${name}`; // prefix of error messages
	var gpu = (mode === 'gpu');
	var params = mf.params;
	var out = [];
	const { count_sources, array_sizes, block, launch, sources } = layout;
	const { work_size } = mf;
	const count_inputs = [...count_sources].filter(idx => params[idx].format === 'int32');
	const has_shapes = array_sizes.some(dimensions => dimensions.length > 1);
	const has_stdin = Object.keys(stdin_idx).length > 0;

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

	function count_of(count) {
		if (typeof count === 'number')
			return `(size_t)${count}ull`;
		const idx = count.param;
		return fmt(params[idx]).array ? `_n${idx}` : `(size_t)_v${idx}`;
	}

	function array_size(idx) {
		const dimensions = array_sizes[idx];
		if (dimensions.length === 1)
			return count_of(dimensions[0]);
		out.push(`\tconst size_t _shape${idx}[] = { ${dimensions.map(count_of).join(', ')} };`);
		return `_wrap_elements(_shape${idx}, ${dimensions.length}, ` +
			`"parameter ${idx}: shape is too large")`;
	}

	// --- header ---
	out.push(`// Generated by scripts/gen_clif_cuda_wrapper.js ` +
		`(format: ${mf.format}, mode: ${mode}).`);
	out.push(`// CLIF wrapper over the ${mf.format} code fragment "${name}".`);
	if (count_inputs.length > 0) {
		out.push(`#include <ctype.h>`);
		out.push(`#include <errno.h>`);
	}
	if (launch)
		out.push(`#include <limits.h>`);
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
		out.push(`// total threads per block`);
		out.push(`#define CUKF_BLOCK_SIZE ` +
			`${block.reduce((product, size) => product * size, 1)}`);
		out.push(``);
	}
	out.push(`// The user code`);
	sources.forEach(src => {
		out.push(`#include ${JSON.stringify(path.resolve(frag_dir, src))}`);
	});
	out.push(``);
	out.push(`static void _wrap_fail(const char *what) {`);
	out.push(`\tfprintf(stderr, "${what}: %s\\n", what);`);
	out.push(`\texit(1);`);
	out.push(`}`);
	out.push(``);

	if (count_inputs.length > 0) {
		out.push(`static int32_t _wrap_parse_count(const char *text, const char *what) {`);
		out.push(`\tif (text == NULL) _wrap_fail(what);`);
		out.push(`\tchar *end;`);
		out.push(`\terrno = 0;`);
		out.push(`\tlong value = strtol(text, &end, 10);`);
		out.push(`\tif (end == text || errno == ERANGE || value < 0 || value > INT32_MAX)`);
		out.push(`\t\t_wrap_fail(what);`);
		out.push(`\twhile (isspace((unsigned char)*end)) end++;`);
		out.push(`\tif (*end != '\\0') _wrap_fail(what);`);
		out.push(`\treturn (int32_t)value;`);
		out.push(`}`);
		out.push(``);
	}

	if (has_shapes || arrays('output').length > 0) {
		out.push(`static size_t _wrap_multiply(size_t a, size_t b, const char *what) {`);
		out.push(`\tif (b != 0 && a > SIZE_MAX / b) _wrap_fail(what);`);
		out.push(`\treturn a * b;`);
		out.push(`}`);
		out.push(``);
	}
	if (has_shapes) {
		out.push(`static size_t _wrap_elements(const size_t *shape, size_t rank, const char *what) {`);
		out.push(`\tfor (size_t axis = 0; axis < rank; axis++)`);
		out.push(`\t\tif (shape[axis] == 0) return 0;`);
		out.push(`\tsize_t size = 1;`);
		out.push(`\tfor (size_t axis = 0; axis < rank; axis++)`);
		out.push(`\t\tsize = _wrap_multiply(size, shape[axis], what);`);
		out.push(`\treturn size;`);
		out.push(`}`);
		out.push(``);
	}

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
		out.push(`\t\t${name}((int)i, ${kargs.join(', ')});`);
		out.push(`}`);
		out.push(``);
	}

	out.push(`int main() {`);
	if (has_stdin) {
		out.push(`\tconst char **stdin_lines = parse_stdin_lines();`);
		out.push(``);
	}

	// --- read inputs ---
	out.push(`\t// read inputs`);
	params.forEach((p, idx) => {
		if (p.kind !== 'input')
			return;
		var line = `stdin_lines[${stdin_idx[idx]}]`;
		if (!fmt(p).array) {
			if (count_sources.has(idx)) {
				out.push(`\tint32_t _v${idx} = _wrap_parse_count(${line}, ` +
					`"parameter ${idx}: expected a nonnegative int32 size");`);
			} else {
				out.push(`\t${fmt(p).ctype} _v${idx} = parse_${p.format}(${line});`);
			}
			return;
		}
		var et = elem_ctype(idx);
		out.push(`\tvoid *_v${idx};`);
		out.push(`\tsize_t _v${idx}_size;`);
		out.push(`\tread_path_blob(${line}, &_v${idx}, &_v${idx}_size);`);
		out.push(`\tif (_v${idx}_size % sizeof(${et}) != 0)`);
		out.push(`\t\t_wrap_fail("parameter ${idx}: the array size is ` +
			`not a multiple of the element size");`);
		if (count_sources.has(idx) || array_sizes[idx])
			out.push(`\tsize_t _n${idx} = _v${idx}_size / sizeof(${et});`);
	});
	out.push(``);

	// Dimensions can reference scalar parameters anywhere in the manifest.
	arrays('input').filter(idx => array_sizes[idx]).forEach(idx => {
		const size = array_size(idx);
		out.push(`\tif (_n${idx} != ${size})`);
		out.push(`\t\t_wrap_fail("parameter ${idx}: input array size does not match shape");`);
	});
	const output_arrays = arrays('output');
	output_arrays.forEach(idx => {
		const size = array_size(idx);
		out.push(`\tconst size_t _n${idx} = ${size};`);
		out.push(`\tconst size_t _v${idx}_size = _wrap_multiply(_n${idx}, ` +
			`sizeof(${elem_ctype(idx)}), "parameter ${idx}: output array is too large");`);
	});
	out.push(``);

	if (launch) {
		out.push(`\t// CUDA launch dimensions (x, y, z)`);
		const axes = launch.axes.map((axis, idx) => {
			const name = ['x', 'y', 'z'][idx];
			const blocks = `_grid_${name}`;
			const count = count_of(axis);
			if (launch.exact_grid) {
				out.push(`\tconst size_t ${blocks} = ${count};`);
			} else {
				const extent = `_extent_${name}`;
				out.push(`\tconst size_t ${extent} = ${count};`);
				out.push(`\tconst size_t ${blocks} = ${extent} / ${block[idx]} + ` +
					`(${extent} % ${block[idx]} != 0);`);
			}
			out.push(`\tif (${blocks} > UINT_MAX)`);
			out.push(`\t\t_wrap_fail("launch: grid dimension ${name} is too large");`);
			return `(unsigned int)${blocks}`;
		});
		out.push(`\tconst dim3 _grid(${axes.join(', ')});`);
		out.push(`\tconst dim3 _block(${block.join(', ')});`);
	} else {
		const first_output = output_arrays[0];
		const work = work_size === undefined ? `_n${first_output}` : count_of(work_size);
		if (work_size === undefined && output_arrays.length > 1) {
			const different = output_arrays.slice(1).map(idx => `_n${idx} != ${work}`);
			out.push(`\tif (${different.join(' || ')})`);
			out.push(`\t\t_wrap_fail("output arrays have different lengths; specify work_size");`);
		}
		out.push(`\tconst size_t _n = ${work};`);
		out.push(`\tif (_n > INT32_MAX)`);
		out.push(`\t\t_wrap_fail("too many elements");`);
		out.push(`\tconst int n = (int)_n;`);
	}
	out.push(``);

	// --- allocate outputs (filled with zeros) ---
	out.push(`\t// allocate outputs`);
	output_arrays.forEach(idx => {
		var et = elem_ctype(idx);
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
			out.push(`\tif (${size} != 0)`);
			if (params[idx].kind === 'input')
				out.push(`\t\t_WRAP_CHECK(cudaMemcpy(_d${idx}, _v${idx}, ` +
					`${size}, cudaMemcpyHostToDevice));`);
			else
				out.push(`\t\t_WRAP_CHECK(cudaMemset(_d${idx}, 0, ${size}));`);
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
		if (cukf) {
			out.push(`\t// the kernel must have exactly the signature ` +
				`given by the manifest`);
			const sig = params.map(p => kernel_ctype(p).trim());
			out.push(`\tvoid (*_signature)(${sig.join(', ')}) = ${name};`);
			out.push(`\t(void)_signature;`);
			out.push(``);
		}
		out.push(`\t// launch the kernel if there is work to do`);
		const kernel = cukf ? name : '_cuef_kernel';
		if (launch) {
			out.push(`\tif (_grid.x != 0 && _grid.y != 0 && _grid.z != 0) {`);
		} else {
			args.unshift('n');
			out.push(`\tif (n > 0) {`);
			out.push(`\t\tconst int _block = ${block[0]};`);
			out.push(`\t\tconst int _grid = (int)(((long long)n + _block - 1) / _block);`);
		}
		out.push(`\t\t${kernel}<<<_grid, _block>>>(${args.join(', ')});`);
		out.push(`\t\t_WRAP_CHECK(cudaGetLastError());`);
		out.push(`\t\t_WRAP_CHECK(cudaDeviceSynchronize());`);
		out.push(`\t}`);
		out.push(``);

		out.push(`\t// copy outputs back, free GPU memory`);
		output_arrays.forEach(idx => {
			out.push(`\tif (_v${idx}_size != 0)`);
			out.push(`\t\t_WRAP_CHECK(cudaMemcpy(_v${idx}, _d${idx}, ` +
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
		out.push(`\t\t${name}(i, ${args.join(', ')});`);
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
	if (has_stdin) {
		out.push(`\tfree((void *)stdin_lines[0]);`);
		out.push(`\tfree((void *)stdin_lines);`);
	}
	out.push(`\treturn 0;`);
	out.push(`}`);
	out.push(``);

	return out.join('\n');
}

// The argv interface is for inspection. Keep the stdin CLIF for bar.
const usage = 'Usage: node scripts/gen_clif_cuda_wrapper.js ' +
	'FRAG_DIR OUT_DIR [--mode gpu|emulate]';
const argv = process.argv.slice(2);
if (argv.length === 1 && argv[0] === '--help') {
	console.log(usage);
	process.exit(0);
}
const cli = argv.length > 0;
const inputs = cli ? argv : fs.readFileSync(0, 'utf-8').split('\n');
if (!inputs[0] || !inputs[1] || (cli && argv.length !== 2 &&
		(argv.length !== 4 || argv[2] !== '--mode')))
	abort(usage);
const frag_dir = path.resolve(inputs[0]);
const clif_dir = path.resolve(inputs[1]);
const mode = cli ? (argv[3] ?? 'gpu') : (inputs[2] || 'gpu');
if (MODES.indexOf(mode) === -1)
	abort("unknown mode (expected gpu or emulate)", mode);

var mf = JSON.parse(fs.readFileSync(path.join(frag_dir, 'manifest.json')));
const layout = check_manifest(mf, mode);

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

var code = gen_wrapper(mf, layout, mode, frag_dir, stdin_idx);

ensure_dir_exists(clif_dir);
const generated = [];
function write_generated(name, content) {
	const filename = path.join(clif_dir, name);
	const fd = fs.openSync(filename, 'wx');
	generated.push(filename);
	try {
		fs.writeFileSync(fd, content, 'utf-8');
	} finally {
		fs.closeSync(fd);
	}
}
try {
	// Reserve the manifest first so concurrent invocations cannot mix modes.
	write_generated('manifest.json', JSON.stringify(clif_mf, null, 2));
	write_generated(clif_mf.src, code);
} catch (error) {
	for (const filename of generated.reverse())
		fs.unlinkSync(filename);
	throw error;
}
if (cli)
	console.log(generated.join('\n'));
