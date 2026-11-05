#include <stdio.h>
#include <stdlib.h> // for malloc
#include <string.h>

// init(in int count, out string)
void init(int count, char **str) {
	int i;

	const char *s = "Hello";
	int len = strnlen(s, 6);
	
	*str = (char*)malloc(len+1);
	memcpy(*str, s, len+1);
}

// sum(in string, out int)
void sum(const char *str, int *total) {
	*total = strnlen(str, 6);
}

