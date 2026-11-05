#!/usr/bin/bash

orig_dir=$PWD
cd `dirname -- ${BASH_SOURCE[0]}`

export AZ=$PWD
export PATH=$PATH:$AZ/bin
export BUILD_DIR=$AZ/build

cd $orig_dir
