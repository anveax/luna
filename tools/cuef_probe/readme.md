cuef probe
==========

A diagnostic tool that shows how a `cuef` fragment really runs on the GPU.
The fragment `probe` records, for every element `i`:

- the block and the thread inside the block that computed it;
- the multiprocessor (SM) of the GPU on which that thread ran;
- when the call started and finished (every call busy-waits for
  `DELAY_US` microseconds).

Run it on a machine with an NVIDIA GPU and `nvcc` (after `make`):

```
tools/cuef_probe/run.sh            # 1000 elements, 1000 us per call
tools/cuef_probe/run.sh 100000 1000
```

The output shows whether `i == block * 256 + thread` for every element,
how many SMs took part, and how long all calls took together compared with
the time they would take one after another.

The probe works only on the GPU: `threadIdx`, `blockIdx`, `%smid` and
`%globaltimer` do not exist in emulation. That is why it lives here and not
in `examples/`, which are also run with `AZ_CUDA=emulate`.
