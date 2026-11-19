Vector times a constant on the GPU
==================================

`c = k * a`, then `s = sum(c)`. The same program as `24_cuef_vadd`, but the
CUDA fragment `scale` also takes a scalar parameter `k`:

```
__device__ void scale(int i, const double *a, double k, double *c)
```

In `scale/manifest.json` the scalar is an ordinary input parameter
(`"format": "real64"`, `"type": "real64"`). It is passed to the generated
kernel by value, so every thread gets the same `k` and no copy to the GPU
is needed. Scalar inputs may be `int32` or `real64`; only outputs must be
arrays (`int32_array` or `real64_array`).

The constant can also be written in the program itself, for example
`scale(a, 2.5, c);`.

The test also transposes a 2 × 3 matrix and compares all six output
elements in row-major order. It declares the input shape as
`[2, {"param": 1}]` and the output shape as `[{"param": 1}, 2]`, where
parameter 1 supplies the column count. The wrapper derives the work size
from the output shape.

See `24_cuef_vadd/readme.md` for the description of the `cuef` format.
