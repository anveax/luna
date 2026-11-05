#include <stdio.h>

#include <iostream>

const char *HELP_MESSAGE=
"%s\n\n"
"NAME\n"
"	%s - LuNA language parser\n\n"
"SYNOPSIS\n"
"	%s INPUT [OPTIONS]...\n"
"	%s --help\n\n"
"OPTIONS\n"
"	-o <path>\n"
"	    Specify output path (a.json by default)\n"
"	-h <path>\n"
"	    Specify headers output path (headers.json) by default)\n"
;

using namespace std;

class FatalError
{
	string msg_;
public:
	FatalError(const string &s) : msg_(s) {}

	const char *c_str() const { return msg_.c_str(); }
};

int line_num = 1;
string line, prev_line;

int yyparse();

const char *get_self_name(const char *path)
{
	const char *self=path;
	while (*path) {
		if (*path=='/') {
			self=path+1;
		}
		path++;
	}
	return self;
}

string headers_path="headers.json";
const char *program=NULL;
const char *out_path=NULL;

void parse_args(int argc, char **argv)
{
	for (int i=0; i<argc; i++) {
		string arg(argv[i]);

		if (arg=="-o") {
			i++;
			if (i==argc) {
				throw FatalError("'-o' requires parameter (argument #"
					+ to_string(i+1) + ")");
			}
			if (out_path) {
				throw FatalError("duplicate '-o' argument "
					+ to_string(i-1));
			}
			out_path=argv[i];
		} else if (arg=="-h") {
			i++;
			if (i==argc) {
				throw FatalError("'-h' requires parameter (argument #"
					+ to_string(i+1) + ")");
			}
			headers_path=argv[i];
		} else if (program) {
			throw FatalError("unexpected argument #"
				+ to_string(i+1) + ": " + arg);
		} else {
			program=argv[i];
		}
	}

	if (!program) {
		throw FatalError("no program specified");
	}

	if (!out_path) {
		out_path="a.json";
	}
}

int main(int argc, char **argv) {
	const char *self=get_self_name(argv[0]);
	for (int i=0; i<argc; i++) {
		if (string("--help")==argv[i]) {
			printf(HELP_MESSAGE, argv[0], self, self, self);
			return 0;
		}
	}

	try {
		parse_args(argc-1, argv+1);
	} catch (FatalError &f) {
		fprintf(stderr, "%s: fatal error: %s\n", self, f.c_str());
		return 1;
	}
	FILE *f=freopen(program, "r", stdin);
	FILE *g=freopen(out_path, "w", stdout);
	yyparse();
	fclose(f);
	fclose(g);
	return 0;
}
