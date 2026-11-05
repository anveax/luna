#!/usr/bin/env python3

import os
import subprocess
import tarfile
import tempfile
from copy import copy
from pathlib import Path

def main():
    path_jaz = input()
    path_input = input()
    path_output = input()

    AZ = Path(__file__).resolve().parent.parent.parent

    with open(path_input, "r") as f_in:
        with open(path_output, "w") as f_out:
            subprocess.run(
                [f'{AZ}/src/baz.js', path_jaz],
                stdin=f_in,
                text=True,
                stdout=f_out
            )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(e.with_traceback(None))