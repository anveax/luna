CUDA kernel fragment (`cukf`)
=============================

This example adds up the elements of an array on the GPU:
`a[i] = i`, `s = sum(a) = n(n - 1)/2` (4999950000 for n = 100000).

`fill` is an ordinary C fragment (`cpf`); `sum` is a CUDA kernel fragment
(`cukf`). Such a sum (a reduction) cannot be written as a `cuef` fragment:
its threads must work together, and its result is a single number.

## The `cukf` format

A `cukf` fragment ("CUDA Kernel Format") is a CUDA kernel (a `__global__`
function) written by the user. Inside the kernel all CUDA features for
device code are available: `threadIdx`, `blockIdx`, shared memory
(`__shared__`), `__syncthreads`, atomic operations. The system generates
memory allocation on the GPU, copying of the data in both directions, the
kernel launch and the error checks.

### The kernel

```
__global__ void <func_name>(<one argument per parameter>);
```

The arguments follow the manifest parameter order. In this example `n`
is an explicit `int32` input passed from the LuNA program.

| `format`       | `type`   | input argument     | output argument |
|----------------|----------|--------------------|-----------------|
| `int32`        | `int32`  | `int32_t`          | `int32_t *`     |
| `real64`       | `real64` | `double`           | `double *`      |
| `int32_array`  | `blob`   | `const int32_t *`  | `int32_t *`     |
| `real64_array` | `blob`   | `const double *`   | `double *`      |

All pointers point to GPU memory. An output number (`int32` or `real64`)
is a single value in GPU memory that any thread may write; use atomic
operations when several threads write it.

The kernel must have exactly this signature (with `int` in place of
`int32_t` if you like: it is the same type), otherwise the wrapper does
not compile.

### Manifest fields

- `format`: `"cukf"`;
- `func_name`: the name of the kernel;
- `params`: with the formats from the table above;
- `launch` specifies either `extent` (logical work
  dimensions) or `grid` (exact block counts), and a `block` shape. CUDA
  dimensions are ordered `x, y, z`. For a one-dimensional launch the
  block shape defaults to `[256]`.
- `src` lists the source files in inclusion order, or names one file.

An input array can declare a `shape` to validate its byte count. Output
arrays declare their size with `size`, `size_from`, or `shape` as in CUEF.
Here `"shape": [{"param": 1}]` checks that `a` contains `n` elements.

### The launch

- The reduction sets `"launch": {"extent": [{"param": 1}], "block": [256]}`.
  This launches `ceil(n / 256)` blocks of 256 threads, so the last block
  may include threads with `i >= n`. A zero work dimension skips launch.
- The macro `CUKF_BLOCK_SIZE` gives the number of threads in a block
  (the product of its dimensions). Use it for arrays in
  shared memory: `__shared__ double part[CUKF_BLOCK_SIZE];`. Dynamic shared
  memory (`extern __shared__`) is not supported.
- All outputs (arrays and numbers) are filled with zeros before the launch.

The test also launches a two-dimensional grid for a 5 × 7 output matrix
with `"launch": {"grid": [2, 3], "block": [4, 2]}`. Threads outside the
matrix skip their writes. The test compares every output element.

### Rules

- Threads of one block are synchronized with `__syncthreads`; threads of
  different blocks can work together only through atomic operations. An
  algorithm that needs several kernel launches is written as several
  fragments.
- Threads with `i >= n` must not touch elements beyond the arrays, but must
  take part in `__syncthreads` like the other threads of the block.
- Input arrays must not be changed.
- Strings are not supported.
- With atomic operations on real numbers the order of additions is not
  defined, so the result may differ slightly from run to run. In this
  example all partial sums are whole numbers below 2^53, so the result is
  exact.

### Running

- `cukf` fragments run only on the GPU and need `nvcc` in `PATH`. With
  `AZ_CUDA=emulate` they fail (so `bar` can use an alternative fragment, if
  there is one); this test is then skipped.
- Only the `bar` interpreter runs `cukf` fragments so far.

Run this command from the repository root to inspect the wrapper and CLIF manifest.

```sh
node scripts/gen_clif_cuda_wrapper.js examples/26_cukf_sum/sum /tmp/sum-wrapper
```
