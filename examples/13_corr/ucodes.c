#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <assert.h>

int hash(const void *, size_t);
int Lg2(int x);
void CalcExps(float *w, int m);
void FFT_I(float *X, const float *W, int M);
void RFFT_I(float *X, const float *W, int M);
void MultConj(float *X, const float *S, int M);

void make_pc(const void *vX1, size_t vX1_size, double B, double C, int L,
				const void *vMeta, size_t vMeta_size,
				void **PC, size_t *PC_size)
{
	size_t M = vX1_size / sizeof(float);
	*PC_size = 42 + M * sizeof(short);
	*PC = malloc(*PC_size);
	memcpy(*PC, vMeta, 42);

#define PUT(ofs, var) memcpy(((char*)(*PC)) + ofs, &var, sizeof(var))
#define SHIFT(ptr, ofs) ((void*)(((char*)(ptr)) + ofs))

	PUT(14, B);
	PUT(34, L);
	short st = 2;
	PUT(38, st);
	char c = *((char*)(SHIFT((*PC), 41)));
	c += 10;
	PUT(41, c);

	short D16[M];

	const float *X1 = (const float *)vX1;

	for (size_t i = 0; i < M; i++)
	{
		D16[i] = (short)X1[i];
	}

	memcpy(SHIFT((*PC), 42), D16, M * sizeof(short));
}
void calc_output_trace(const void *vX, size_t vX_size_,
							int L, double A,
							int a, int b,
							double *B_, 
							double *C_,
							void **vX1_, size_t *vX1_size_)
{
	double B = 0, C = 0;
	const float *X = (const float *)vX;

	for (int i = 0; i < L; i++)
		if ((B = fabs(X[i])) > C)
			C = B;
	B = 32767. / C; // C-correlation

	float *X1 = (float *)malloc(L * sizeof(float));
	*vX1_ = X1;
	*vX1_size_ = L * sizeof(float);

	for (int i = 0; i < L; i++)
		X1[i] = (X[i] * B);

	B = C / A * a; // real amplituda

	double sum = 0;
	double sums = 0;
	for (int i = b; i < L; i++)
	{
		sum += X[i];
		sums += X[i] * X[i];
	} // b=1.5*L;
	C = C / sqrt((sums - sum * sum / (L - b)) / (L - b - 1)); // SNR

	*B_ = B;
	*C_ = C;
}
void fft_multconj_rfft(const void *vX0, size_t vX0_size_,
						 const void *vW, size_t vW_size_,
						 const void *vS, size_t vS_size_,
						 int M, int p,
						 void **vX1_, size_t *vX1_size_)
{
	float *X = (float *)malloc(M * sizeof(float));
	memcpy(X, vX0, M * sizeof(float));
	FFT_I(X, (const float *)vW, p);
	MultConj(X, (const float *)vS, p);
	RFFT_I(X, (const float *)vW, p);

	*vX1_ = X;
	*vX1_size_ = M * sizeof(float);
}

void extract_samples(const void *raw, size_t raw_size,
	int M, int Fs_, void **vX_, size_t *vX_size_)
{
	short Fs = Fs_;

	float *X = (float *)calloc(M, sizeof(float)); // current trace samples
	
//	*meta_size_ = 42;

	const short *d = (const short *)raw;

	if (*d != 0x4350)
	{
		fprintf(stderr, "error: invalid format");
		exit(1);
	}
	if (*(d + 16) != Fs)
	{
		fprintf(stderr, "error: sampling frequency mismatch");
		exit(1);
	}
	short st = *(d + 19);

	if (st == 2)
	{
		for (int i = 0; i < M; i++)
		{
			size_t ofs = 42 + i * sizeof(short);
			if (ofs + 4 > raw_size)
				break;
			short D16 = *((const short*)(SHIFT(raw, 42 + i*sizeof(short))));
			X[i] = (float)D16;
		}
	}
	else
	{
		if (raw_size != 42 + M * sizeof(int)) {
			fprintf(stderr, "wrong size (int)\n");
		}
		for (int i = 0; i < M; i++)
		{
			int D = *((const int*)(SHIFT(raw, 42 + i * sizeof(int))));
			X[i] = (float)D;
		}
	}

	*vX_ = X;
	*vX_size_ = M * sizeof(float);
}

void fft_i(const void *vS0, size_t vS0_size,
				const void *vW, size_t vW_size,
				int M, int p, 
				void **vS1_, size_t *vS1_size_)
{
	float *S1 = (float *)malloc(M * sizeof(float));
	assert(M*sizeof(float) == (1 << p) * sizeof(float));
	memcpy(S1, vS0, M * sizeof(float));
	FFT_I(S1, (const float *)vW, p);
	*vS1_ = S1;
	*vS1_size_ = M * sizeof(float);
}

void CalcExps(float *w, int m);
void calc_exps(int M, int p, void **vW_, size_t *W_size_)
{
	float **W_ = (float **)vW_;
	float *W = (float *)malloc(M * sizeof(float));
	memset(W, 0, M*sizeof(float));
	CalcExps(W, p);
	*W_ = W;
	*W_size_ = M * sizeof(float);
}

void calc_coeff(const void *vS, size_t vS_size, int L,
					int *a_, int *b_, double *A_)
{
	const float *S = (const float *)vS;
	size_t S_size = vS_size / sizeof(float);
	int a = 0;
	int b = 0;

	double A = 0;

	for (int i = 0; i < S_size; i++)
	{
		int D = (int)S[i];
		if ((b = abs(D)) > a)
			a = b;
		A += D * D;
	}

	b = (int)(0.5 * L);

	*a_ = a;
	*b_ = b;
	*A_ = A;
	//printf("A = %lf\n", A);
}

int Lg2(int x);

void add(int *res, int a, int b) {
	*res = a+b;
}

void compute_size(const void *data, size_t size, int *res) {
	*res = (int)size;
}

void parse_opora(const void *opora, size_t opora_size, int argv3_,
					int *Fs_, int *L_, int *M_, int *p_,
					void **S__, size_t *S__size,
					void **vMeta_, size_t *vMeta_size)
{
	short Fs;
	int N;
	short st;
	int L;
	int p;
	int M;
	int _ofs;

	// Answer to the Ultimate Question of Life, the Universe, and Everything
	*vMeta_size = 42;
	*vMeta_ = malloc(42);
	memcpy(*vMeta_, opora, 42);

#define GET(dest, type) dest = (*((type*)(SHIFT(opora,_ofs)))); _ofs+=sizeof(type);

	_ofs = 0;
	GET(Fs, short);
	if (Fs != 0x4350)
	{
		fprintf(stderr, "Invalid format of opora");
		exit(1);
		return;
	}

	_ofs=32;
	GET(Fs, short); // read sampling frequency
	GET(N, int); // read sampl.num
	GET(st, short); // read sampl.type

	L = argv3_ * Fs;
	p = Lg2(N + L);
	M = 1u << p;
	if (M < L)
		L = M;

	float *S = (float *)calloc(M, sizeof(float)); // opora.dat samples

	_ofs = 42;

	if (st == 2)
	{
		for (int i = 0; i < N; i++)
		{
			short D16;
			GET(D16, short);
			S[i] = (float)D16;
		}
	}
	else
	{
		for (int i = 0; i < N; i++)
		{
			int D;
			GET(D, int);
			S[i] = (float)D;
		}
	}

	*S__ = S;
	*S__size = M * sizeof(float);
	*Fs_ = Fs;
	*L_ = L;
	*M_ = M;
	*p_ = p;
}

