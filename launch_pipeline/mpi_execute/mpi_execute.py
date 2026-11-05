#!/usr/bin/env python3

import os
import subprocess
import tarfile
import tempfile
from copy import copy
from pathlib import Path


def main():
    path_codefrag = input()
    np = input()
    path_input = input()
    path_output = input()

    archive_path = os.path.abspath(path_codefrag)

    AZ = Path(__file__).resolve().parent.parent.parent

    if not os.path.isfile(archive_path):
        raise FileNotFoundError(f"Archive not found: {archive_path}")

    with tempfile.TemporaryDirectory() as tmp_dir:
        target_dir = copy(tmp_dir)
        with tarfile.open(archive_path, "r:*") as tar:
            tar.extractall(path=tmp_dir)

            # получаем верхнюю директорию в архиве
            members = tar.getmembers()
            top_dirs = set(m.name.split("/")[0] for m in members)

            if len(top_dirs) == 1:
                top_dir_name = top_dirs.pop()
                target_dir = os.path.join(target_dir, top_dir_name)
            else:
                raise RuntimeError(f"В архиве несколько верхнеуровневых директорий: {top_dirs}")

        input_dir = copy(tmp_dir)

        with tarfile.open(path_input, "r:*") as tar:
            tar.extractall(path=tmp_dir)
            # получаем верхнюю директорию в архиве
            members = tar.getmembers()
            top_dirs = set(m.name.split("/")[0] for m in members)

            if len(top_dirs) == 1:
                top_dir_name = top_dirs.pop()
                input_dir = os.path.join(tmp_dir, top_dir_name)
            else:
                raise RuntimeError(f"В архиве несколько верхнеуровневых директорий: {top_dirs}")

        with tempfile.TemporaryDirectory() as output_dir:
            subprocess.run(
                ['mpirun', '-np',  f'{np}', f'{AZ}/scripts/run_mpi.sh', f'--file={target_dir}/a.out', f'--input_dir={input_dir}', f'--output_dir={output_dir}'],
                text=True
            )

            with tarfile.open(path_output, "w") as tar:
                tar.add(output_dir, arcname=os.path.basename("stdout"))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(e.with_traceback(None))