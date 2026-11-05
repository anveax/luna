#include <stdio.h>
#include <stddef.h> // for size_t
#include <stdlib.h> // for malloc

// sum(in int[] numbers, out int sum)
void sum(const void *nums, size_t nums_size, int *total) {
	int i;
	const int *ptr = (const int*)nums;
	int count = nums_size / sizeof(int);
	*total = 0;

	for (i=0; i<count; i++)
		*total += ptr[i];
}

