__device__ static double sum_row(const double *row, int cols) {
	double sum = 0.0;
	for (int col = 0; col < cols; ++col)
		sum += row[col];
	return sum;
}
