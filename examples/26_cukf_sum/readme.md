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
__global__ void <func_name>(int n, <one argument per parameter>);
```

- `n` is the number of threads set by `threads_from`;
- then one argument for each manifest parameter, in the same order:

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
- `threads_from`: the index of the input parameter that sets `n`. If that
  parameter is an array, `n` is its number of elements; if it is an
  `int32`, `n` is its value;
- `block_size` (optional, 1 to 1024, default 256): threads per block;
- `size_from` (output arrays only): the number of elements of the output
  array, by the same rule as `threads_from`;
- `src`: the source file (or a list of files) with the kernel. It is
  included into the generated code.

### The launch

- The kernel is launched once, with `ceil(n / block_size)` blocks of
  `block_size` threads. The last block may be incomplete, so there may be
  more threads than `n`: the kernel must check `i < n`. If `n = 0`, the
  kernel is not launched.
- The macro `CUKF_BLOCK_SIZE` equals the block size. Use it for arrays in
  shared memory: `__shared__ double part[CUKF_BLOCK_SIZE];`. Dynamic shared
  memory (`extern __shared__`) is not supported.
- All outputs (arrays and numbers) are filled with zeros before the launch.

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
