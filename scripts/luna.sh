#!/bin/bash

set -e

if [[ "$AZ" == "" ]]; then
  echo "\$AZ not set"
  exit 1;
fi

if [[ "$BUILD_DIR" == "" ]]; then
  echo "\$BUILD_DIR not set"
  exit 1;
fi

NAME_SCRIPT=$0

BD=$BUILD_DIR
FILE=$1
IFACE="main"

shift

print_help() {
    cat << 'EOF'
1. Использование:
   a. $path_to_script/luna [keys] file [--np=number] [--stdin_pr=in] [--stdout_pr=out]
      i.    keys - возможные ключи:
            i. -    "--help" - для вывода этого текста, скрипт не будет выполнен
            ii. -   "--jaz" - если в аргументе file будет передана вычислительная модель
      ii.  file – путь до файла описания задачи (.luna), или до файла вычислительной модели, если указан "--jaz"
      iii. --np=number      - используется для указания количества, на которое разделены входные данные
      iv.  --stdin_pr=in    - используется для распределенных входных данных, процесс с i-м рангом получит на вход содержимое файла {in}{i}. Пример: --stdin=input, процесс с рангом 3 получает на вход файл input3. Используется, если интерфейс задачи dclif.
      v.   --stdout_pr=out  - используется для распределенных выходных данных, процесс с i-м рангом запишет выходные данные в файл {out}{i}. Пример: --stdout=output, процесс с рангом 3 пишет данные в файл output3. Используется, если интерфейс задачи dclif.

   b. Предполагаемое использование скрипта – генерация, компиляция и запуск
      программы.

   c. Выходные данные сгенерированной программы будут записаны в stdout, а входные взяты из stdin, если интерфейс отличается от dclif

   d. Если используется dclif, то опции --np, --stdin_pr, --stdout_pr должны быть указаны. Содержимое stdin игнорируется.

2. Описание:
   a. Скрипт поддерживает несколько ветвей запуска:
      i.   Стандартными средствами системы Az
      ii.  С интерпретатором bar
      iii. С интерпретатором baz
      iv.  Средствами mpi, если интерфейс задачи dclif

   b. Для запуска скрипта должны быть установлены следующие переменные окружения
      i.   AZ - переменная, содержащая путь до системы
      ii.  BUILD_DIR - переменная до директории, которая будет содержать все временные файлы

EOF
}

if [[ "$FILE" == "--help" ]]; then
  print_help
  exit 0;
fi

if [[ "$FILE" == "--jaz" ]]; then
  IFACE="jaz"
  FILE=$1
  shift
fi

STDIN_PR=""
STDOUT_PR=""
NP=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --stdin_pr=*)
            STDIN_PR="${1#*=}"
            shift
            ;;
        --stdout_pr=*)
            STDOUT_PR="${1#*=}"
            shift
            ;;
        --np=*)
            NP="${1#*=}"
            shift
            ;;
        *)
          shift
          ;;
    esac
done

if [[ "$STDIN_PR" == "" && "$STDOUT_PR" == "" && "$NP" == "" ]]; then

  STDIN=$(cat)
  STDIN_FILE="$BD/stdin"
  STDOUT_FILE="$BD/stdout"

  echo -e "$STDIN" > $STDIN_FILE

  BASE_DIR=$(realpath "$(dirname "$FILE")" 2>/dev/null || (cd "$(dirname "$FILE")" && pwd))
  INPUT_DATA="$FILE\n$BASE_DIR\n$STDIN_FILE\n$STDOUT_FILE"

  echo -e "$INPUT_DATA" | $AZ/scripts/luna_internal.sh $AZ/launch_pipeline/launch_pipeline.luna "--iface=$IFACE"

  cat $STDOUT_FILE

elif [[ "$STDIN_PR" == "" ]]; then
  echo "$NAME_SCRIPT: --stdin_pr= not set"
elif [[ "$NP" == "" ]]; then
  echo "$NAME_SCRIPT: --np= not set"
else
  if [[ "$STDOUT_PR" == "" ]]; then
    STDOUT_PR="out"
  fi

  echo -e "$STDIN_PR\n$BD" | $AZ/launch_pipeline/converter_in.py

  STDIN_TAR="$BD/$STDIN_PR.tar"
  STDOUT_TAR="$BD/$STDOUT_PR.tar"

  BASE_DIR=$(realpath "$(dirname "$FILE")" 2>/dev/null || (cd "$(dirname "$FILE")" && pwd))
  INPUT_DATA="$FILE\n$BASE_DIR\n$NP\n$STDIN_TAR\n$STDOUT_TAR"

  echo -e "$INPUT_DATA" | $AZ/scripts/luna_internal.sh $AZ/launch_pipeline/launch_pipeline.luna --iface=$IFACE\_mpi

  echo -e "$STDOUT_PR\n$BD" | $AZ/launch_pipeline/converter_out.py
  cat $BD/$STDOUT_PR\_*

fi
