#include <stdio.h>
#include <stddef.h> // for size_t
#include <stdlib.h> // for malloc

void int_init(int value, int *result){
    *result = value;
}

void sum_two_num(int first, int second, int *total){
    *total = first + second;
}

void array_init(int count, void **numbers, size_t *numbers_size) {
	int i;
	int *ptr;
	size_t size;

	size = count * sizeof(int);
	ptr = (int*)malloc(size);

	for (i=0; i<count; i++) {
		ptr[i] = 1;
	}

	*numbers = (void*)ptr;
	*numbers_size = size;
}

void smulv2_part(const void *nums_1, size_t nums_size_1,
                 const void *nums_2, size_t nums_size_2,
                 int *total) {
    int i;
	const int *ptr_1 = (const int*)nums_1;
	const int *ptr_2 = (const int*)nums_2;
	int count = nums_size_1 / sizeof(int);
	*total = 0;

	for (i=0; i<count; i++)
		*total += ptr_1[i] * ptr_2[i];
}

