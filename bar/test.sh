#!/bin/bash

set -e
#set -x


echo -e "\nlocal tests"
echo -e "10\n20\n30\n" | node 01_stdin.js
node 02_dep.js
echo -e "5\n10\n3\n" | node 03_fib.js
echo -en "hello\nthere\n" | node 04_echo.js
echo -en "10\n20\n" | node bari.js ../examples/01_inc/main.jaz
echo -en "10\n20\n1.tmp\n" | node bari.js ../examples/02_path/main.jaz
xxd 1.tmp
rm 1.tmp

echo -en "12.3\n" | node bari.js ../examples/03_real/real.jaz

echo -e "\n04_sum_inc"
AZ_END=70 ../scripts/luna_internal.sh ../examples/04_sum_inc/sum_inc.luna
echo -en "11\n5\n" | node bari.js ../build/70_noconst.jaz

echo -e "\n06_minmax"
AZ_END=70 ../scripts/luna_internal.sh ../examples/06_minmax/minmax.luna
echo -en "11\n5\n" | node bari.js ../build/70_noconst.jaz

echo -e "\n07_arr"
AZ_END=70 ../scripts/luna_internal.sh ../examples/07_arr/arr.luna
echo -en "100\n" | node bari.js ../build/70_noconst.jaz

echo -e "\n08_loop"
AZ_END=70 ../scripts/luna_internal.sh ../examples/08_loop/loop.luna
echo -en "0\n" | node bari.js ../build/70_noconst.jaz

echo -e "\n09_path"
AZ_END=70 ../scripts/luna_internal.sh ../examples/09_path/test.luna
echo -n "12345" > 1.bin
echo -en "1.bin\n2.bin\n" | node bari.js ../build/70_noconst.jaz

xxd 1.bin
xxd 2.bin
rm 1.bin 2.bin

echo -e "\n10_plan"
AZ_END=70 ../scripts/luna_internal.sh ../examples/10_plan/plan.luna
echo -en "12\n" | node bari.js ../build/70_noconst.jaz

echo -e "\n11_string"
AZ_END=70 ../scripts/luna_internal.sh ../examples/11_string/str.luna
echo -en "11\n" | node bari.js ../build/70_noconst.jaz

echo -e "\n13_corr"
AZ_END=70 ../scripts/luna_internal.sh ../examples/13_corr/corr.luna
cp -r ../examples/13_corr/data .
INPUT="data/16_11011500.U8831Vk00\ndata/16_11011500.U8831Vk00\n\
data/opora.dat\n300\n\
data/conv1.out\ndata/conv2.out\n"
echo -en "$INPUT\n" | node bari.js ../build/70_noconst.jaz

rm -rf data

echo -e "\n15_triangle_llm"
AZ_END=70 ../scripts/luna_internal.sh ../examples/15_triangle_llm/triangle.luna
echo -en "50\n30\n" | node bari.js ../build/70_noconst.jaz

echo -e "\n16_clif_sh"
AZ_END=70 ../scripts/luna_internal.sh ../examples/16_clif_sh/clif_import.luna
echo -en "31\n23\n" | node bari.js ../build/70_noconst.jaz

echo -e "\n17_clif_path"
AZ_END=70 ../scripts/luna_internal.sh ../examples/17_clif_path/clif_import.luna
echo -en "../examples/17_clif_path/test.bin\nresult.bin\n" | node bari.js ../build/70_noconst.jaz
xxd ../examples/17_clif_path/test.bin
xxd result.bin
rm result.bin

echo -e "\n18_sleep"
AZ_END=70 ../scripts/luna_internal.sh ../examples/18_sleep/sleep.luna
echo -en "1\n" | node bari.js ../build/70_noconst.jaz

