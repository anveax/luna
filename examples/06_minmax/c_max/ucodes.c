#include <stdio.h>
#include <stddef.h> // for size_t
#include <stdlib.h> // for malloc

//import "c_func_simple" c_min(in int, in int, out int) as min;
static
void c_min(int a, int b, int *res) {
	*res = a<b? a: b;
}

//import "c_func_simple" c_max(in int, in int, out int) as min;
void c_max(int a, int b, int *res) {
	*res = a<b? b: a;
}

