void inc(int, int*);

void inc2(int num, int *res) {
	int tmp;
	inc(num, &tmp);
	inc(tmp, res);
}
