#!/bin/bash

set -e
#set -x #verbose

FILE=$1
JAZ=$2
MPI_NP="1"

shopt -s nullglob

while [[ $# -gt 0 ]]; do
  case "$1" in
      --iface=*)
          IFACE="${1#*=}"
          shift
          ;;
      *)
          shift
          ;;
  esac
done

print_help() {
    cat << 'EOF'
1. Использование:
   a. $path_to_script/luna [keys] file ...
      i.    keys - возможные ключи:
            i. -    "--help" - для вывода этого текста, скрипт не будет выполнен
            ii. -   "--jaz" - если в аргументе file будет передана вычислительная модель
      ii.  file – путь до файла описания задачи (.luna), или до файла вычислительной модели, если указан "--jaz"

   b. Предполагаемое использование скрипта – генерация, компиляция и запуск
      программы.

   c. Выходные данные сгенерированной программы будут записаны в stdout

2. Описание:
   a. Скрипт поддерживает 2 ветки генерации:
      i.   Стандартными средствами системы Az
      ii.  Средствами MPIGenerator, если установлена переменная MPIGEN, являющаяся путём до директории с файлами MPIGenerator

   b. Для запуска скрипта должны быть установлены следующие переменные окружения
      i.   AZ - переменная, содержащая путь до системы
      ii.  BUILD_DIR - переменная до директории, которая будет содержать все временные файлы

EOF
}

if [[ "$FILE" == "--help" ]]; then
    print_help
    exit 0;
fi

if [[ "$AZ" == "" ]]; then
	echo "\$AZ not set"
	exit 1;
fi

if [[ "$BUILD_DIR" == "" ]]; then
	echo "\$BUILD_DIR not set"
	exit 1;
fi

BD=$BUILD_DIR

if [[ "$FILE" == "--jaz" ]]; then
	BASE_DIR=$(realpath "$(dirname "$JAZ")" 2>/dev/null || (cd "$(dirname "$JAZ")" && pwd))
else
  if [[ "$FILE" == "--conf" ]]; then
    source $JAZ
    FILE=$SOURCE
  fi
  # Preprocess
  $AZ/parser/pp.py $FILE -o $BD/10_preprocessed.pp

  # Parse grammar
  $AZ/bin/parser $BD/10_preprocessed.pp -o $BD/20_prog.ja
  # Pretty print json
  cat $BD/20_prog.ja | node $AZ/scripts/ppjson.js \
      > $BD/30_prog.json

  # Unroll loops
  cat $BD/30_prog.json | node $AZ/scripts/unroll.js \
      > $BD/40_unrolled.json

  JAZ=$BD/50_prog.jaz

  # Convert to jaz
  cat $BD/40_unrolled.json | node $AZ/scripts/convert.js > $JAZ

  BASE_DIR=$(realpath "$(dirname "$FILE")" \
    2>/dev/null || (cd "$(dirname "$FILE")" && pwd))

fi

NEXT="$BD/55_with_bd.jaz"

echo -e "$JAZ\n.base_dir\n$BASE_DIR\n$NEXT\n" | node $AZ/scripts/inject.js

JAZ=$NEXT
NEXT="$BD/60_fetched.jaz"

# fetch codes
echo -e "$JAZ\n$NEXT\n$BD/60_cf_deps\n" | node $AZ/scripts/fetch_codes.js

if [[ "$AZ_END" == "60" ]]; then
	exit 0 # only generate 60_fetched.jaz
fi

JAZ=$NEXT
NEXT="$BD/70_noconst.jaz"

# Subst consts
cat $JAZ | node $AZ/scripts/subst_consts.js > $NEXT

if [[ "$AZ_END" == "70" ]]; then
	exit 0 # only generate 60_fetched.jaz
fi

if [[ "$IFACE" == "" ]]; then
  node --allow-natives-syntax $AZ/bar/bari.js $NEXT
else
  node --allow-natives-syntax $AZ/bar/bari.js $NEXT --iface=$IFACE
fi

exit 0

JAZ=$NEXT
NEXT="$BD/80_plan.jaz"

if [[ "$IFACE" == "" ]]; then
  (
    set -e
    cat $JAZ | node $AZ/scripts/obtain_plan.js > $NEXT
  )
else
  (
    set -e
    echo -e "$JAZ\n$IFACE" | node $AZ/scripts/obtain_plan_with_iface.js > $NEXT
  )
fi


JAZ=$NEXT
NEXT="$BD/90_schedule.jaz"

# Generate schedule
echo -e "$JAZ\n$MPI_NP" | node $AZ/scripts/gen_schedule.js > $NEXT

JAZ=$NEXT

if [[ "$JAZ" == "" ]]; then
	echo "\$JAZ not set"
	exit 1;
fi

cfiles=(*.c)

rm -f $BD/*.o

run_normal_build() {
  rm -rf "$BD/a0_codefrag"
  echo -e "$JAZ\n$BD/a0_codefrag" | node "$AZ/scripts/gen_codefrag.js"
  ofiles=("$BD"/*.o)
	
  if [[ "$RUN_MODE" == "mpi/dclif" ]]; then
    >&2 echo -n " (mpi) "
    mpicxx -g -o "$BD/a.out" -I "$AZ/src" $AZ/src/clif.c $AZ/src/pipe.c \
      $AZ/src/read_inputs.c \
      $AZ/src/read_fd_lines.c $AZ/src/dclif.cpp "${ofiles[@]}" \
      "$BD/a0_codefrag"/*.c `cat $BD/60_cf_deps` -lm

    mpirun -np $MPI_NP \
      $AZ/scripts/run_mpi.sh $DCLIF_STDINS $BD/a.out $BD/stdout

    cat $BD/stdout*
  else
    >&2 echo -n " (seq) "
    gcc -g -o "$BD/a.out" -I "$AZ/src" $AZ/src/clif.c $AZ/src/pipe.c \
      $AZ/src/read_inputs.c \
      $AZ/src/read_fd_lines.c "${ofiles[@]}" \
      "$BD/a0_codefrag"/*.c `cat $BD/60_cf_deps` -lm

      $BD/a.out
  fi
}

if [[ "$MPIGEN" != "" ]]; then
    (
        set -e

        echo -e "$JAZ\n$BD/a0_codefrag" | $MPIGEN/main.py 2>/dev/null || exit 1

        rm -rf "$BD/b0_wrapped"
        echo -e "$BD/a0_codefrag\n$BD/b0_wrapped" | node "$AZ/scripts/gen_clif_cpf_wrapper.js" 2>/dev/null || exit 1

        $MPIGEN/modify_mpi.py "$BD/b0_wrapped/code.c"

        ofiles=("$BD"/*.o)

        mpicc -g -o "$BD/a.out" -I "$AZ/src" $(ls "$AZ/src/"*.c | grep -v "test_pipe.c") "${cfiles[@]}" "${ofiles[@]}" "$BD/a0_codefrag"/*.c "$BD/b0_wrapped"/*.c -lm 2>/dev/null || exit 1

        mpirun -np 4 "$BD/a.out" 

    ) # || run_normal_build
else
    run_normal_build
fi
