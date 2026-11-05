#!/usr/bin/env python3

import os
import re
import shutil
import tarfile
import tempfile
from copy import copy
from pathlib import Path

def extract_number(name: str):
    m = re.search(r"_(\d+)$", name)
    return m.group(1) if m else None

def main():
    prefix = input()
    build_dir = Path(input())

    if not build_dir.exists():
        raise NotADirectoryError(f"Build directory not found: {build_dir}")

    archive_path = build_dir / f"{prefix}.tar"

    with tempfile.TemporaryDirectory() as tmp_dir:
        target_dir = copy(tmp_dir)
        with tarfile.open(archive_path, "r:*") as tar:
            tar.extractall(tmp_dir)

            # получаем верхнюю директорию в архиве
            members = tar.getmembers()
            top_dirs = set(m.name.split("/")[0] for m in members)

            if len(top_dirs) == 1:
                top_dir_name = top_dirs.pop()
                target_dir = os.path.join(target_dir, top_dir_name)
            else:
                raise RuntimeError(f"В архиве несколько верхнеуровневых директорий: {top_dirs}")

        extracted_files = list(Path(target_dir).rglob("*"))
        extracted_files = [f for f in extracted_files if f.is_file()]

        for file in extracted_files:
            number = extract_number(file.name)
            if number is None:
                continue

            new_name = f"{prefix}_{number}"
            target_path = build_dir / new_name

            shutil.move(str(file), str(target_path))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(e.with_traceback(None))