#include <stdio.h>
#include <stddef.h> // for size_t
#include <stdlib.h> // for malloc

//import "c_func_simple" c_reverse(in blob, out blob) as reverse;
void c_reverse(const void *d, size_t ds, void **r, size_t *rs) {
	int i;
	const char *in;
	char *out;

	*r = malloc(ds);
	*rs = ds;

	in = (const char*)d;
	out = (char *)(*r);

	for (i=0; i<ds; i++)
		out[i] = in[ds-i-1];
}
