#!/bin/bash
# Runs the diagnostic cuef fragment on the GPU and prints which thread
# computed which element.
#
# Usage: tools/cuef_probe/run.sh [N] [DELAY_US]
#   N        -- number of elements (default 1000)
#   DELAY_US -- how long every call waits, in microseconds (default 1000)

set -e

N=${1:-1000}
DELAY_US=${2:-1000}

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export AZ=${AZ:-$(cd "$DIR/../.." && pwd)}
export BUILD_DIR=${BUILD_DIR:-$AZ/build}
export AZ_CUDA=gpu # the probe uses features that exist only on the GPU
mkdir -p "$BUILD_DIR"

OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

printf '%s\n' "$N" "$DELAY_US" "$OUT/block" "$OUT/thread" "$OUT/sm" \
	"$OUT/t_start" "$OUT/t_end" | "$AZ/bin/luna" "$DIR/probe.luna" > /dev/null

python3 "$DIR/analyze.py" "$OUT" "$N" "$DELAY_US"
