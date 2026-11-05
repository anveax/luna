#!/usr/bin/env python3
import os
import subprocess
from pathlib import Path


def main():
    path_in = input()
    path_out = input()

    AZ = Path(__file__).resolve().parent.parent.parent

    result = subprocess.run(
        [f"{AZ}/parser/pp.py", path_in, "-o", path_out],
        capture_output=True,
        text=True
    )

if __name__ == "__main__":
    main()