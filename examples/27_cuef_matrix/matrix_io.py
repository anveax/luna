#!/usr/bin/env python3

from array import array
from pathlib import Path
from struct import unpack
import sys


def make_matrix(rows, cols):
    values = array('d', range(1, rows * cols + 1))
    with Path(input()).open('wb') as output:
        values.tofile(output)


def format_matrix(rows, cols):
    transposed = unpack(f'={rows * cols}d', Path(input()).read_bytes())
    row_sums = unpack(f'={rows}d', Path(input()).read_bytes())

    print(f'Transposed matrix ({cols} x {rows})')
    if rows:
        for offset in range(0, len(transposed), rows):
            print(*(format(value, '.17g') for value in transposed[offset:offset + rows]))
    print('Row sums')
    print(*(format(value, '.17g') for value in row_sums))


if __name__ == '__main__':
    rows = int(input())
    cols = int(input())
    if rows < 0 or cols < 0 or rows * cols > 2**31 - 1:
        sys.exit('Matrix dimensions must be nonnegative and fit in the CUEF index range')

    if sys.argv[1] == 'make':
        make_matrix(rows, cols)
    elif sys.argv[1] == 'format':
        format_matrix(rows, cols)
    else:
        sys.exit('Expected make or format')
