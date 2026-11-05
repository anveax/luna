#!/usr/bin/env python3

import os
import subprocess
import tarfile
import tempfile
from pathlib import Path


def main():
    path_in = input()
    path_out = input()

    with tempfile.TemporaryDirectory() as tmp_dir:
        AZ = Path(__file__).resolve().parent.parent.parent

        dir_name = f'{tmp_dir}/a0_codefrag'
        os.makedirs(dir_name, exist_ok=True)

        subprocess.run(
            ["node", f"{AZ}/scripts/gen_codefrag.js"],
            input=f"{path_in}\n{dir_name}\n",
            text=True,
            capture_output=True
        )

        # Создание tar-архива
        with tarfile.open(path_out, "w") as tar:
            tar.add(dir_name, arcname=os.path.basename(dir_name))

if __name__ == "__main__":
    main()
