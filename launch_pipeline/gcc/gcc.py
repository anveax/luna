#!/usr/bin/env python3

import json
import os
import subprocess
import glob
import tarfile
import tempfile
from copy import copy
from pathlib import Path

def main():
    path_codefrag_c = input()
    path_cf_deps = input()
    path_out = input()

    AZ = Path(__file__).resolve().parent.parent.parent

    # --- src/*.c кроме test_pipe.c
    src_c_files = [
        f for f in glob.glob(f"{AZ}/src/*.c")
        if not f.endswith("test_pipe.c")
    ]

    # --- deps из файла
    with open(path_cf_deps) as f:
        deps = f.read().split()

    archive_path = os.path.abspath(path_codefrag_c)

    if not os.path.isfile(archive_path):
        raise FileNotFoundError(f"Archive not found: {archive_path}")

    with tempfile.TemporaryDirectory() as tmp_dir:
        target_dir = copy(tmp_dir)
        with tarfile.open(archive_path, "r:*") as tar:
            # data filter: safe extraction and no DeprecationWarning (Python 3.12+)
            tar.extraction_filter = getattr(tarfile, "data_filter", None)
            tar.extractall(path=tmp_dir)

            # получаем верхнюю директорию в архиве
            members = tar.getmembers()
            top_dirs = set(m.name.split("/")[0] for m in members)

            if len(top_dirs) == 1:
                top_dir_name = top_dirs.pop()
                target_dir = os.path.join(target_dir, top_dir_name)
            else:
                raise RuntimeError(f"В архиве несколько верхнеуровневых директорий: {top_dirs}")

            # --- codefrag *.c
            codefrag_c_files = glob.glob(f"{target_dir}/*.c")

            target_file = f'{target_dir}/a.out'

            cmd = (
                    ["gcc", "-o", target_file, "-I", f"{AZ}/src"]
                    + src_c_files
                    + codefrag_c_files
                    + deps
                    + ["-lm"]
            )

            subprocess.run(cmd, check=True)

            manifest_path = f'{target_dir}/manifest.json'
            with open(manifest_path) as f:
                manifest = json.load(f)

            manifest["executable"] = "a.out"
            with open(manifest_path, "w") as f:
                json.dump(manifest, f)

            # Создание tar-архива
            with tarfile.open(path_out, "w") as tar:
                tar.add(target_dir, arcname=os.path.basename(target_dir))



if __name__ == "__main__":
    main()