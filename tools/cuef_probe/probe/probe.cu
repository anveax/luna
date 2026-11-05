// Diagnostic cuef fragment: records which GPU thread computed element i,
// on which multiprocessor (SM) it ran, and when it started and finished.
// Every call busy-waits for delay_us microseconds, so the total time shows
// whether the calls ran one after another or at the same time.
//
// GPU only: threadIdx, blockIdx, %smid and %globaltimer do not exist in
// emulation (AZ_CUDA=emulate), so this file does not compile there.

__device__ static unsigned long long probe_now_ns() {
	unsigned long long t;
	asm volatile("mov.u64 %0, %%globaltimer;" : "=l"(t));
	return t;
}

__device__ void probe(int i, int n, int count, int delay_us,
		int *block, int *thread, int *sm, double *t_start, double *t_end) {
	unsigned int smid;
	asm volatile("mov.u32 %0, %%smid;" : "=r"(smid));

	unsigned long long start = probe_now_ns();
	unsigned long long wait = (unsigned long long)delay_us * 1000ull;
	while (probe_now_ns() - start < wait)
		;
	unsigned long long end = probe_now_ns();

	block[i] = blockIdx.x;
	thread[i] = threadIdx.x;
	sm[i] = (int)smid;
	t_start[i] = start / 1000.0; // microseconds
	t_end[i] = end / 1000.0;
}
