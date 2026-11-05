#!/bin/bash

orig_dir=`pwd`
script_dir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )"\
	&> /dev/null && pwd )

cd $script_dir/..
source env.sh
export AZ=`pwd`
cd $orig_dir

test_dir=$1

cd $test_dir
test_dir=`pwd`
cd $orig_dir

echo "TEST DIR: $test_dir"

for t in `ls $test_dir`; do
	echo -n "TEST: $t"
	export LIB="123$t"
	export BUILD_DIR=$AZ/build/_test_$t
	[ -d $BUILD_DIR ] || mkdir $BUILD_DIR
	cd $test_dir/$t
	./test
	if [ "$?" -ne "0" ]; then
		echo " - TEST FAILED"
		exit 1
	else
		echo " - OK"
	fi
	cd $orig_dir
done

echo "ALL TESTS PASSED"
