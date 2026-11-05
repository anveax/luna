#include <stddef.h>

// s = sum of all elements of an array of doubles
void sum(const void *arr, size_t arr_size, double *s) {
	const double *ptr = (const double *)arr;
	size_t n = arr_size / sizeof(double);
	size_t i;

	*s = 0;
	for (i = 0; i < n; i++)
		*s += ptr[i];
}
