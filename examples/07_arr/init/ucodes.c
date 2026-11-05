#include <stdio.h>
#include <stddef.h> // for size_t
#include <stdlib.h> // for malloc

// init(in int count, out int[] numbers)
void init(int count, void **numbers, size_t *numbers_size) {
	int i;
	int *ptr;
	size_t size;

	size = count * sizeof(int);
	ptr = (int*)malloc(size);

	for (i=0; i<count; i++) {
		ptr[i] = i+1;
	}

	*numbers = (void*)ptr;
	*numbers_size = size;
}

