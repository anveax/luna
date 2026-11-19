__device__ void transpose_and_sum(int i, const double *a, int rows, int cols,
		double *transposed, double *row_sums) {
	int row = i / cols;
	int col = i % cols;
	transposed[col * rows + row] = a[i];

	// The first element in each row owns that row's sum.
	if (col == 0)
		row_sums[row] = sum_row(&a[i], cols);
}
