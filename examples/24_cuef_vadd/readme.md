CUDA element fragment (`cuef`)
==============================

This example adds two vectors on the GPU and prints the sum of the result:
`a[i] = i`, `b[i] = 2i`, `c = a + b`, `s = sum(c) = 3n(n - 1)/2`
(1498500 for n = 1000).

`fill` and `sum` are ordinary C fragments (`cpf`); `vadd` is a CUDA
fragment (`cuef`).

## The `cuef` format

A `cuef` fragment ("CUDA Element Format") is a CUDA `__device__` function
that computes **one element** of the result. The user writes only this
function. The system generates the kernel, memory allocation on the GPU,
copying of the data in both directions, the kernel launch and the error
checks.

### The user function

```
__device__ void <func_name>(int i, <one argument per parameter>);
```

The wrapper passes the linear element index `i` and one argument for each
manifest parameter in the same order. Declare an `int32` input if the
function also needs the number of elements.

| `format`       | `type`   | input argument     | output argument |
|----------------|----------|--------------------|-----------------|
| `int32`        | `int32`  | `int32_t`          | not allowed     |
| `real64`       | `real64` | `double`           | not allowed     |
| `int32_array`  | `blob`   | `const int32_t *`  | `int32_t *`     |
| `real64_array` | `blob`   | `const double *`   | `double *`      |

`int32_t` is the same type as `int` on the platforms CUDA supports.

As in `cpf` and `clif`, `type` is the type of the value and `format` says
how it is passed to the code. An array format is a `blob` whose bytes are
elements of the given type. The system needs the element size to count
the elements (threads) and to allocate the outputs before the kernel
starts, so it is part of the format.

### Manifest fields

- `format`: `"cuef"`;
- `func_name`: the name of the `__device__` function;
- `params`: as in `cpf`, with the formats from the table above;
- `src` lists the source files in inclusion order, or names one file.
- `work_size` optionally sets the number of calls as a nonnegative integer or
  a reference such as `{"param": 0}`. A reference uses the number of
  elements in an input array or the value of an `int32` input. By default
  the wrapper uses the common output length. Outputs of different lengths
  require an explicit `work_size`.

Each output array declares its element count with exactly one of `size`,
`size_from`, or `shape`. A `size` is a literal, and `size_from` is a
zero-based index of an input array or `int32` input. A `shape` gives the
dimensions of a contiguous, row-major array. A dimension is a nonnegative
integer or a reference to an `int32` input. Input arrays may also declare
their `shape` to validate the number of bytes received.

This example sizes its output with `"size_from": 0`, so its number of
calls equals the length of the first input vector.

### Rules

- Outputs can only be arrays. A single number cannot be written
  by many threads at once: compute it afterwards with another fragment
  (as `sum` does here).
- Calls must be independent. The usual pattern writes element `i` of each
  output. The function must keep every write in bounds and must not read
  outputs written by other calls.
- Strings are not supported.
- Output arrays are filled with zeros before the call, both on the GPU and
  in emulation.

### Running

- By default the fragment runs on the GPU. This needs `nvcc` in `PATH`
  (CUDA 12.8 or newer for GeForce RTX 50xx cards).
- With `AZ_CUDA=emulate` the same function is compiled by an ordinary C++
  compiler and called in a loop on the CPU. No GPU is needed, so this mode
  works on macOS as well. It checks everything except the GPU itself.
  Code that uses features which exist only on the GPU (`threadIdx`,
  `atomicAdd`, ...) does not compile in this mode.
- Only the `bar` interpreter runs `cuef` fragments so far; the other
  branches of the pipeline (gcc, MPI) do not support them yet.

Run this command from the repository root to inspect the wrapper and CLIF manifest.

```sh
node scripts/gen_clif_cuda_wrapper.js examples/24_cuef_vadd/vadd /tmp/vadd-wrapper
```
