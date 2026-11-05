#!/bin/bash

set -e
#set -x #verbose

source env.sh

make test

echo -e "\n01_inc"
echo -e "10\n20\n" | node src/baz.js examples/01_inc/main.jaz 
echo -e "10\n20\n" | bin/luna --jaz examples/01_inc/main.jaz

echo -e "\n02_path"
echo -e "10\n20\n1.tmp\n" | node src/baz.js examples/02_path/main.jaz
xxd 1.tmp
rm 1.tmp
echo -e "10\n20\n1.tmp\n" | bin/luna --jaz examples/02_path/main.jaz
xxd 1.tmp
rm 1.tmp

echo -e "\n03_real"
echo -e "12.3\n" | node src/baz.js examples/03_real/real.jaz
echo -e "12.3\n" | bin/luna --jaz examples/03_real/real.jaz

echo -e "\n04_sum_inc"
echo -e "11\n5\n" | bin/luna examples/04_sum_inc/sum_inc.luna
echo -e "11\n5\n" | AZ_END=60 scripts/luna_internal.sh examples/04_sum_inc/sum_inc.luna
echo -e "11\n5\n" | node src/baz.js build/60_fetched.jaz

echo -e "\n05_sum_inc2"
echo -e "10\n6\n" | bin/luna examples/05_sum_inc2/sum_inc.luna
echo -e "10\n6\n" | AZ_END=60 scripts/luna_internal.sh examples/05_sum_inc2/sum_inc.luna
echo -e "10\n6\n" | node src/baz.js  build/60_fetched.jaz

echo -e "\n06_minmax"
echo -e "11\n6\n" | bin/luna examples/06_minmax/minmax.luna
echo -e "11\n6\n" | AZ_END=60 scripts/luna_internal.sh examples/06_minmax/minmax.luna
echo -e "11\n6\n" | node src/baz.js  build/60_fetched.jaz

echo -e "\n07_arr"
echo -e "100\n" | bin/luna examples/07_arr/arr.luna
echo -e "100\n" | AZ_END=60 scripts/luna_internal.sh examples/07_arr/arr.luna
echo -e "100\n" | node src/baz.js build/60_fetched.jaz 

echo -e "\n08_loop"
echo -e "0\n" | bin/luna examples/08_loop/loop.luna
echo -e "0\n" | AZ_END=70 scripts/luna_internal.sh examples/08_loop/loop.luna
echo -e "0\n" | node src/baz.js build/70_noconst.jaz

echo -e "\n09_path"
echo -n "12345" > 1.bin
echo -e "1.bin\n2.bin\n" | bin/luna examples/09_path/test.luna
xxd 2.bin
rm 2.bin
echo -e "1.bin\n2.bin\n" | AZ_END=70 scripts/luna_internal.sh examples/09_path/test.luna
echo -e "1.bin\n2.bin\n" | node src/baz.js build/70_noconst.jaz
xxd 2.bin
rm 2.bin
rm 1.bin

echo -e "\n10_plan"
echo -e "12\n" | bin/luna examples/10_plan/plan.luna
echo -e "12\n" | AZ_END=70 scripts/luna_internal.sh examples/10_plan/plan.luna
echo -e "12\n" | node src/baz.js build/70_noconst.jaz

echo -e "\n11_string"
echo -e "11\n" | bin/luna examples/11_string/str.luna
echo -e "11\n" | AZ_END=70 scripts/luna_internal.sh examples/11_string/str.luna
echo -e "11\n" | node src/baz.js build/70_noconst.jaz

echo -e "\n13_corr"
cp -r examples/13_corr/data .
INPUT="data/16_11011500.U8831Vk00\ndata/16_11011500.U8831Vk00\n\
data/opora.dat\n300\n\
data/conv1.out\ndata/conv2.out"
echo -e "$INPUT\n" | bin/luna examples/13_corr/corr.luna
rm -rf data

cp -r examples/13_corr/data .
echo -e "$INPUT\n" | AZ_END=70 scripts/luna_internal.sh examples/13_corr/corr.luna
echo -e "$INPUT\n" | node src/baz.js build/70_noconst.jaz
rm -rf data

echo -e "\n15_triangle_llm"
echo -en "50\n30\n" | bin/luna examples/15_triangle_llm/triangle.luna
echo -en "50\n30\n" | AZ_END=60 scripts/luna_internal.sh examples/15_triangle_llm/triangle.luna
echo -en "50\n30\n" | node src/baz.js build/60_fetched.jaz

echo -e "\n16_clif_sh"
echo -e "31\n23\n" | AZ_END=60 scripts/luna_internal.sh examples/16_clif_sh/clif_import.luna
echo -e "31\n23\n" | node src/baz.js build/60_fetched.jaz

echo -e "\n17_clif_path"
echo "hello" > "qtest.txt"
echo -e "qtest.txt\nqtest2.txt\n" | bin/luna examples/17_clif_path/clif_import.luna
cat "qtest2.txt"
rm -rf "qtest2.txt"

echo -e "qtest.txt\nqtest2.txt\n" | AZ_END=60 scripts/luna_internal.sh examples/17_clif_path/clif_import.luna
echo -e "qtest.txt\nqtest2.txt\n" | node src/baz.js build/60_fetched.jaz
cat "qtest2.txt"
rm -rf "qtest.txt"
rm -rf "qtest2.txt"

echo -e "\n18_sleep"
echo -e "1\n" | bin/luna examples/18_sleep/sleep.luna
echo -e "1\n" | AZ_END=70 scripts/luna_internal.sh examples/18_sleep/sleep.luna
echo -e "1\n" | node src/baz.js build/70_noconst.jaz

cd bar
./test.sh
