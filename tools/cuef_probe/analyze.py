#!/usr/bin/env python3
"""Prints which GPU thread computed which element (output of probe.luna).

Usage: analyze.py DIR N DELAY_US

DIR contains the files written by probe.luna: block, thread, sm (int32)
and t_start, t_end (float64, microseconds).
"""

import os
import struct
import sys
from collections import Counter

BLOCK_SIZE = 256  # threads per block in the generated cuef kernel


def read(path, fmt, size):
    if not os.path.exists(path):
        sys.exit(f"{path} not found: the probe did not run "
                 f"(see the messages above)")
    with open(path, "rb") as f:
        data = f.read()
    return list(struct.unpack(f"<{len(data) // size}{fmt}", data))


def main():
    out_dir, n, delay_us = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    block = read(f"{out_dir}/block", "i", 4)
    thread = read(f"{out_dir}/thread", "i", 4)
    sm = read(f"{out_dir}/sm", "i", 4)
    t_start = read(f"{out_dir}/t_start", "d", 8)
    t_end = read(f"{out_dir}/t_end", "d", 8)

    if any(len(a) != n for a in (block, thread, sm, t_start, t_end)):
        sys.exit(f"expected {n} elements in every output")

    print(f"elements: {n}, blocks: {len(set(block))}, "
          f"threads per block: {max(thread) + 1}")

    print("\nsample (element: block, thread, SM)")
    for i in sorted({0, 1, 2, BLOCK_SIZE - 1, BLOCK_SIZE, BLOCK_SIZE + 1,
                     n - 1}):
        if 0 <= i < n:
            print(f"  c[{i}]: block {block[i]}, thread {thread[i]}, "
                  f"SM {sm[i]}")

    mapping_ok = all(i == block[i] * BLOCK_SIZE + thread[i]
                     for i in range(n))
    unique = len(set(zip(block, thread))) == n
    print(f"\ni == block * {BLOCK_SIZE} + thread for every element: "
          f"{'yes' if mapping_ok else 'NO'}")
    print(f"every element computed by its own thread: "
          f"{'yes' if unique else 'NO'}")

    per_sm = Counter(sm)
    shown = ", ".join(f"SM {k}: {v}" for k, v in sorted(per_sm.items())[:12])
    more = ", ..." if len(per_sm) > 12 else ""
    print(f"\nSMs used: {len(per_sm)} (threads per SM: {shown}{more})")

    wall = max(t_end) - min(t_start)
    busy = sum(e - s for s, e in zip(t_start, t_end))
    print(f"\neach call waited: {delay_us} us")
    print(f"time of all {n} calls together: {wall / 1000:.3f} ms")
    print(f"time if they ran one after another: {busy / 1000:.1f} ms")
    if wall > 0:
        print(f"calls running at the same time, on average: "
              f"{busy / wall:.0f}")


if __name__ == "__main__":
    main()
