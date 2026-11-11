// Sum of the elements of an array (reduction).
// Every block adds up its part of the array in shared memory, then adds
// the result to the total with an atomic operation. The block size must be
// a power of two.
__global__ void sum(int n, const double *a, double *s)
{
	__shared__ double part[CUKF_BLOCK_SIZE];
	int t = threadIdx.x;
	long long i = (long long)blockIdx.x * blockDim.x + t;

	// threads with i >= n add zeros, but still take part in __syncthreads
	part[t] = (i < n) ? a[i] : 0.0;
	__syncthreads();

	for (int k = blockDim.x / 2; k > 0; k /= 2) {
		if (t < k)
			part[t] += part[t + k];
		__syncthreads();
	}

	if (t == 0)
		atomicAdd(s, part[0]);
}
