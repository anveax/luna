#!/usr/bin/python3

# CLIF
#	in int32 x
#	in int32 y
#	out int32 sum

import sys

[x, y] = map(int, (sys.stdin.readlines())[:2])
print(min(x, y))