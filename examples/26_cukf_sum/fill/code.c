#include <stdlib.h>

// arr[i] = k * i for i = 0..n-1, stored as doubles
void fill(int n, int k, void **arr, size_t *arr_size) {
	size_t size = (size_t)n * sizeof(double);
	double *ptr = (double *)malloc(size);
	int i;

	for (i = 0; i < n; i++)
		ptr[i] = (double)k * i;

	*arr = ptr;
	*arr_size = size;
}
