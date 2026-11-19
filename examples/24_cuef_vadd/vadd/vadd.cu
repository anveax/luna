// Computes one element of c = a + b.
// i is the index of the element.
__device__ void vadd(int i, const double *a, const double *b,
		double *c) {
	c[i] = a[i] + b[i];
}
