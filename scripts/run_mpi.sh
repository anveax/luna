#!/bin/bash
# Присваиваем аргументы переменным
RANK=$MPI_LOCALRANKID #OMPI_COMM_WORLD_NODE_RANK
if [[ "$RANK" == "" ]]; then RANK=$OMPI_COMM_WORLD_NODE_RANK; fi

INPUT_DIR=""
OUTPUT_DIR=""
FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --file=*)
            FILE="${1#*=}"
            shift
            ;;
        --input_dir=*)
            INPUT_DIR="${1#*=}"
            shift
            ;;
        --output_dir=*)
            OUTPUT_DIR="${1#*=}"
            shift
            ;;
        *)
          shift
          ;;
        esac
done

if [[ "$INPUT_DIR" == "" ]]; then
  echo "--input_dir= not set"
  exit 0;
fi
if [[ "$OUTPUT_DIR" == "" ]]; then
  echo "--output_dir= not set"
  exit 0;
fi
if [[ "$FILE" == "" ]]; then
  echo "--file= not set"
  exit 0;
fi

INPUT_FILE="$INPUT_DIR/*_$RANK"
OUTPUT_FILE="$OUTPUT_DIR/out_$RANK"

cat $INPUT_FILE | $FILE > $OUTPUT_FILE