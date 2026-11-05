// Computes one element of c = a + b.
// i is the index of the element, n is the number of elements.
__device__ void vadd(int i, int n, const double *a, const double *b,
		double *c) {
	c[i] = a[i] + b[i];
}
