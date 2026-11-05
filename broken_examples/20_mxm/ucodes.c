#include <stdio.h>
#include <stddef.h> // for size_t
#include <stdlib.h> // for malloc
#include <math.h>

void init_int(int value, int *result){
    *result = value;
}

void init_matrix(int N, void **numbers, size_t *numbers_size) {
	int i;
	int *ptr;
	size_t size;

	size = N * N * sizeof(int);
	ptr = (int*)malloc(size);

	for (i = 0; i < N * N; i++) {
		ptr[i] = 1;
	}

	*numbers = (void*)ptr;
	*numbers_size = size;
}

void copy_matrix(const void *nums, size_t nums_size,
                 void **result, size_t *result_size) {

	const int *ptr = (const int*)nums;
	int count = nums_size / sizeof(int);

	int *ptr_result = (int*)malloc(nums_size);

	for (int i = 0; i < count; i++)
		ptr_result[i] = ptr[i];

    *result = (void*)ptr_result;
	*result_size = nums_size;
}

void sum_matrix(const void *nums_1, size_t nums_size_1,
                 const void *nums_2, size_t nums_size_2,
                 void **result, size_t *result_size) {

	const int *ptr_1 = (const int*)nums_1;
	const int *ptr_2 = (const int*)nums_2;
	int count = nums_size_1 / sizeof(int);

	int *ptr_result = (int*)malloc(nums_size_1);

	for (int i = 0; i < count; i++)
		ptr_result[i] = ptr_1[i] + ptr_2[i];

    *result = (void*)ptr_result;
	*result_size = nums_size_1;
}

void mul_matrix(const void *nums_1, size_t nums_size_1,
                 const void *nums_2, size_t nums_size_2,
                 void **result, size_t *result_size) {

	const int *ptr_1 = (const int*)nums_1;
	const int *ptr_2 = (const int*)nums_2;
	int count = nums_size_1 / sizeof(int);
	int n = sqrt(count);

	int *ptr_result = (int*)malloc(nums_size_1);

    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            for (int k = 0; k < n; k++)
                ptr_result[i * n + j] += ptr_1[i * n + k] * ptr_2[k * n + j];

    *result = (void*)ptr_result;
	*result_size = nums_size_1;
}

// sum(in int[] numbers, out int sum)
void sum_matrix_elements(const void *nums, size_t nums_size, int *total) {
	int i;
	const int *ptr = (const int*)nums;
	int count = nums_size / sizeof(int);
	*total = 0;

	for (i = 0; i < count; i++)
		*total += ptr[i];
}

void sum_two_num(int first, int second, int *total){
    *total = first + second;
}
