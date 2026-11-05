# -----------
# LuNA Parser
# -----------

CXX_WARN ?= \
	-Wall -Werror -Wpedantic -Wno-vla -Wno-sign-compare \
	-Wno-unused-but-set-variable -Wno-unused-variable \
	-Wno-unused-function
CXX_FLAGS += \
	-I ${mkfile_dir}/include \
	-std=c++11 -fPIC \
	-O3 ${CXX_WARN}

all: bin/luna bin/parser

bin/luna:
	make bin
	cd bin; ln -s ../scripts/luna.sh luna

bin/parser: parser/parser.cpp build/grammar.tab.cpp build/lex.yy.cpp
	make bin
	${CXX} ${CXX_FLAGS} parser/parser.cpp build/grammar.tab.cpp \
		build/lex.yy.cpp -o bin/parser

build/grammar.tab.hpp build/grammar.tab.cpp: parser/grammar.ypp
	make build
	cd build ; bison -d ../parser/grammar.ypp

build/lex.yy.cpp: parser/lexics.l build/grammar.tab.hpp
	make build
	flex -o build/lex.yy.cpp parser/lexics.l

bin:
	[ -d bin ] || mkdir bin

build:
	[ -d build ] || mkdir build

test: all
	scripts/run_all_tests.sh examples


.PHONY: clean
clean:
	rm -rf bin build
	rm -rf parser/__pycache__
