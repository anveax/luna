Vector times a constant on the GPU
==================================

`c = k * a`, then `s = sum(c)`. The same program as `24_cuef_vadd`, but the
CUDA fragment `scale` also takes a scalar parameter `k`:

```
__device__ void scale(int i, int n, const double *a, double k, double *c)
```

In `scale/manifest.json` the scalar is an ordinary input parameter
(`"type": "real64"`, no `elem`). It is passed to the generated kernel by
value, so every thread gets the same `k` and no copy to the GPU is needed.
Scalar inputs may be `int32` or `real64`; only outputs must be arrays.

The constant can also be written in the program itself, for example
`scale(a, 2.5, c);`.

See `24_cuef_vadd/readme.md` for the description of the `cuef` format.
