# A matrix with `shape` and `work_size`

This CUEF fragment transposes a matrix and sums its rows. With the test input, the two outputs are:

```text
Input (2 × 3)    Transpose (3 × 2)    Row sums (2)
1  2  3          1  4                6  15
4  5  6          2  5
                 3  6
```

The [manifest](transpose_and_sum/manifest.json) stores the input and output matrices as row-major `blob` values. Parameter indexes start at zero. Parameter 1 is `rows` and parameter 2 is `cols`. The input shape is `[rows, cols]`, and the transpose shape is `[cols, rows]`. The wrapper checks that the input has exactly `rows * cols` elements. The row sums use `"size_from": 1` to allocate one number per input row.

The two outputs contain six and two elements, respectively. `"work_size": { "param": 0 }` uses the element count of the input matrix, so the [device function](transpose_and_sum/matrix.cu) gets six calls. Each call copies one matrix element, and the call for the first column of each row writes that row's sum.

For automatic work size, see [example 24](../24_cuef_vadd/vadd/manifest.json), where the sole output determines the number of CUEF calls. For a CUKF launch configuration, see the [reduction in example 26](../26_cukf_sum/sum/manifest.json).

Run from the LuNA repository root:

```sh
make
source env.sh
BUILD_DIR="$BUILD_DIR/_test_27_cuef_matrix" AZ_CUDA=emulate ./examples/27_cuef_matrix/test
```

The test compares every element in both outputs. The input, `transpose.bin`, `row_sums.bin`, and intermediate LuNA files stay in `build/_test_27_cuef_matrix/` after the test. On a machine with CUDA, run with `AZ_CUDA=gpu` to use the GPU.
