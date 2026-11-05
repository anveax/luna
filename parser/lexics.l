%{

#include <string>
#include <cstring>

using namespace std;

#ifndef YYSTYPE
#define YYSTYPE string
#endif

extern YYSTYPE yylval;

#include "grammar.tab.hpp"

void yyerror(const char*);
void next_line();
void next_token(const string&);

string yystring();

%}

%%

as { next_token(yystring()); return KW_AS; }
cf { next_token(yystring()); return KW_CF; }
import { next_token(yystring()); return KW_IMPORT; }
export { next_token(yystring()); return KW_EXPORT; }
stdin { next_token(yystring()); return KW_STDIN; }
stdout { next_token(yystring()); return KW_STDOUT; }
for { next_token(yystring()); return KW_FOR; }
if { next_token(yystring()); return KW_IF; }
else { next_token(yystring()); return KW_ELSE; }
let { next_token(yystring()); return KW_LET; }
in { next_token(yystring()); return KW_IN; }
on { next_token(yystring()); return KW_ON; }
out { next_token(yystring()); return KW_OUT; }
SIZE { next_token(yystring()); return KW_SIZE; }
sub { next_token(yystring()); return KW_SUB; }
while { next_token(yystring()); return KW_WHILE; }
int { next_token(yystring()); return KW_INT; }
interface { next_token(yystring()); return KW_INTERFACE; }
blob { next_token(yystring()); return KW_BLOB; }
path { next_token(yystring()); return KW_PATH; }
real32 { next_token(yystring()); return KW_REAL32; }
real { next_token(yystring()); return KW_REAL; }
string { next_token(yystring()); return KW_STRING; }
name { next_token(yystring()); return KW_NAME; }
value { next_token(yystring()); return KW_VALUE; }
rush { next_token(yystring()); return KW_RUSH; }
static { next_token(yystring()); return KW_STATIC; }
static_for { next_token(yystring()); return KW_STATIC_FOR; }
unrolling { next_token(yystring()); return KW_UNROLLING; }

"$" { next_token(yystring()); return BUCK; }
"&" { next_token(yystring()); return AMP; }
"=" { next_token(yystring()); return EQ; }
"<" { next_token(yystring()); return LT; }
">" { next_token(yystring()); return GT; }
";" { next_token(yystring()); return SCOLON; }
":" { next_token(yystring()); return COLON;}
"?" { next_token(yystring()); return QMARK;}
"," { next_token(yystring()); return COMMA; }
"." { next_token(yystring()); return DOT; }
".." { next_token(yystring()); return DIAP; }
"{" { next_token(yystring()); return LCB; }
"}" { next_token(yystring()); return RCB; }
"(" { next_token(yystring()); return LB; }
")" { next_token(yystring()); return RB; }
"[" { next_token(yystring()); return LSB; }
"]" { next_token(yystring()); return RSB; }
"+" { next_token(yystring()); return PLUS; }
"-" { next_token(yystring()); return MINUS; }
"*" { next_token(yystring()); return MUL; }
"/" { next_token(yystring()); return DIV; }
"%" { next_token(yystring()); return MOD; }
"#" { next_token(yystring()); return SHARP; }
"@" { next_token(yystring()); return AT; }
"==" { next_token(yystring()); return DBLEQ; }
"<=" { next_token(yystring()); return LEQ; }
"=>" { next_token(yystring()); return EQG; }
">=" { next_token(yystring()); return GEQ; }
"!=" { next_token(yystring()); return NEQ; }
"&&" { next_token(yystring()); return DBLAMP; }
"||" { next_token(yystring()); return DBLPIPE; }
"-->" { next_token(yystring()); return ARROW; }
"<--" { next_token(yystring()); return LARROW; }
"<<" { next_token(yystring()); return LARR; }
">>" { next_token(yystring()); return RARR; }
"C++" { next_token(yystring()); return KW_CPP; }
"__block" { next_token(yystring()); return KW_BLOCK; }

[0-9]+ {
	yylval = yystring();
	next_token(yystring()); return INT;
}

[0-9]+"."[0-9]+ {
	yylval = yystring();
	next_token(yystring()); return REAL;
}

\/\/.*$ { next_token(yystring()); /* comments */ }
\"[^\"]*\" { yylval = yystring(); next_token(yystring()); return STRING; }

[A-Za-z_][A-Za-z0-9_]* {
	yylval = yystring();
	next_token(yystring()); return NAME;
}

\n { next_line(); next_token(yystring()); }

[ \t]+ { yylval = yystring(); next_token(yystring()); }

. { yyerror((string("invalid symbol: ") + yystring()).c_str()); }

%%

extern int cur;
extern int line_num;
extern string line;
extern string prev_line;

void next_line() {
	if (!line.empty()) {
		prev_line = line;
	}
	line = "";
	line_num++;
}

void next_token(const string &s) {
	yylloc.first_column=cur;
	
	cur+=s.size();
	line += s;

	yylloc.last_column=cur;
}

string yystring() {
	return string(yytext, yyleng);
}

int yywrap() {
	next_token(yystring()); 
	return 1;
}
