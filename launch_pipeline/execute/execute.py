#!/usr/bin/env python3

import os
import subprocess
import tarfile
import tempfile
from copy import copy


def main():
    path_codefrag = input()
    path_input = input()
    path_output = input()

    archive_path = os.path.abspath(path_codefrag)

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

        with open(path_input, "r") as f_in:
            with open(path_output, "w") as f_out:
                subprocess.run(
                    [f'{target_dir}/a.out'],
                    stdin=f_in,
                    text=True,
                    stdout=f_out
                )


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(e.with_traceback(None))