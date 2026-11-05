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
__device__ void <func_name>(int i, int n, <one argument per parameter>);
```

- `i` is the index of the element, `0 <= i < n`;
- `n` is the number of elements (one GPU thread per element);
- then one argument for each manifest parameter, in the same order:

| `kind`   | `type`   | `elem`   | C argument        |
|----------|----------|----------|-------------------|
| `input`  | `int32`  | —        | `int`             |
| `input`  | `real64` | —        | `double`          |
| `input`  | `blob`   | `int32`  | `const int *`     |
| `input`  | `blob`   | `real64` | `const double *`  |
| `output` | `blob`   | `int32`  | `int *`           |
| `output` | `blob`   | `real64` | `double *`        |

### Manifest fields

- `format`: `"cuef"`;
- `func_name`: the name of the `__device__` function;
- `params`: as in `cpf`; every `blob` parameter also needs `elem`, the
  type of its elements (`int32` or `real64`);
- `threads_from`: the index of the input parameter that sets `n`. If that
  parameter is a `blob`, `n` is its number of elements; if it is an
  `int32`, `n` is its value;
- `size_from` (outputs only): the number of elements of the output array,
  by the same rule as `threads_from`;
- `src`: the source file (or a list of files) with the function. It is
  included into the generated code.

### Rules

- Outputs can only be arrays (`blob`). A single number cannot be written
  by many threads at once: compute it afterwards with another fragment
  (as `sum` does here).
- Elements must be computed independently: the call for element `i`
  should write only element `i` of each output and must not read outputs
  written by other calls.
- Strings are not supported.
- Output arrays are filled with zeros before the call, both on the GPU and
  in emulation.

### Running

- By default the fragment runs on the GPU. This needs `nvcc` in `PATH`
  (CUDA 12.8 or newer for GeForce RTX 50xx cards).
- With `AZ_CUDA=emulate` the same function is compiled by an ordinary C++
  compiler and called in a loop on the CPU. No GPU is needed, so this mode
  works on macOS as well. It checks everything except the GPU itself.
