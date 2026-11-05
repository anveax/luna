#!/usr/bin/env python3

import os
import re
import tarfile
from pathlib import Path


def main():
    prefix = input()
    build_dir = Path(input())

    if not build_dir.exists():
        raise NotADirectoryError(f"Build directory not found: {build_dir}")

    cwd = Path(os.getcwd())

    pattern = re.compile(rf"^{re.escape(prefix)}_\d+$")

    files = [
        f for f in cwd.iterdir()
        if f.is_file() and pattern.match(f.name)
    ]

    if not files:
        raise FileNotFoundError(f"Could not find any files")

    archive_path = build_dir / f"{prefix}.tar"

    with tarfile.open(archive_path, "w") as tar:
        for file in files:
            arcname = Path(prefix) / file.name
            tar.add(file, arcname=str(arcname))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(e.with_traceback(None))