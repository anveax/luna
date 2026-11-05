#include <stdio.h>
#include <stdlib.h> // for malloc
#include <string.h>

void make_copy(const void *data, size_t size,
		void **copy, size_t *copy_size) {
	*copy = malloc(size);
	memcpy(*copy, data, size);
	*copy_size = size;
}

