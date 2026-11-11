// one element: c[i] = k * a[i]
__device__ void scale(int i, int n, const double *a, double k, double *c)
{
	c[i] = k * a[i];
}
