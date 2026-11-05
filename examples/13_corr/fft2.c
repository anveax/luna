#include <math.h>
#include <stdio.h>
#include <assert.h>

#if !defined M_PI
#define M_PI 3.14159265359
#endif
#define uint unsigned int

int Lg2(int x)
{
	int i, y;
	for (i = 0, y = 1; y < x; i++, y *= 2)
		;
	return i;
}

static uint IncRev(uint x, uint bit)
{
	while (x & bit)
	{
		x ^= bit;
		bit >>= 1;
	}
	return x | bit;
}

//===== ��������� ������������ ��� ��� ��������� ������������ �������������������. M - ������� ��������������.
void CalcExps(float *w, int m)
{
	const uint n = 1 << m, hi = 1 << (m - 2);
	const float a = -2 * M_PI / n;
	uint i, j, k, u, v, r = hi >> 1;
	for (i = 2, u = 1, v = hi; i < n / 2; i <<= 1, u <<= 1, v >>= 1)
	{
		for (j = 0; j < u; j++)
		{
			k = i + j;
			w[k] = cos(r * a);
			w[k + u] = sin(r * a);
			r = IncRev(r, hi);
		}
		r = IncRev(r, v);
	}
}

#include <string.h>   // для memcpy

int hash(const void *arr, size_t size) {
    const unsigned char *bytes = (const unsigned char *)arr;
    unsigned int hash = 5381;          // начальное значение
    size_t i;

    // Обрабатываем полные 4-байтовые блоки
    for (i = 0; i < size / 4; i++) {
        unsigned int word;
        // Безопасное копирование 4 байт (избегаем проблем с выравниванием)
        memcpy(&word, bytes + i * 4, 4);
        hash = hash * 33 ^ word;
    }

    // Обрабатываем оставшиеся байты (0–3)
    size_t rem = size % 4;
    unsigned int last = 0;
    for (i = 0; i < rem; i++) {
        // Собираем байты в одно целое (little-endian порядок)
        last |= ((unsigned int)bytes[size - rem + i]) << (i * 8);
    }
    hash = hash * 33 ^ last;

    return (int)hash;
}
int hash4(const void *arr, size_t size) {
	int i, res=0;

	assert(size % 4 == 0);

	for(i=0; i<size/4; i++) {
		const int *p = ((const int *)arr) + i;
		res = res ^ *p;
	}

	return res;
}

//===== ��������� ������ ������������ ������������������, ��������� - � ������� X, M - ������� ��������������.
void FFT_I(float *X, const float *W, int M)
{
	const int N = 1 << M;
	int step, szgr, ngr, G, G2, stgr, i, j;
	float *PAR, *PBR, *PAI, *PBI, AR, AI, BR, BI, WR, WI, WBR, WBI;
	for (step = 0, szgr = N / 2; step < M; step++, szgr >>= 1)
	{
		i = ((szgr + 1) >> 1);
		for (j = 0; j < i; j++)
		{
			PAR = X + j;
			PBR = PAR + szgr;
			AR = *PAR;
			BR = *PBR;
			*PAR = AR + BR;
			*PBR = AR - BR;
		}
		for (j = i; j < szgr; j++)
		{
			PAR = X + j;
			PBR = PAR + szgr;
			AR = *PAR;
			BR = *PBR;
			*PAR = AR + BR;
			*PBR = BR - AR;
		}
		for (G = (szgr << 1), stgr = 2, G2 = (szgr << 2), ngr = 1; G <= N / 4; G <<= 1, stgr <<= 1, G2 <<= 1, ngr <<= 1)
			for (i = 0; i < ngr; i++)
			{
				WR = W[stgr + i];
				WI = W[stgr + i + ngr];
				for (j = 0; j < szgr; j++)
				{
					PAR = X + G2 + (i << (M - step)) + j;
					PBR = PAR + szgr;
					PAI = PAR + G;
					PBI = PBR + G;
					BR = *PBR;
					BI = *PBI;
					WBR = BR * WR - BI * WI;
					WBI = BR * WI + BI * WR;
					AR = *PAR;
					AI = *PAI;
					*PAR = AR + WBR;
					*PAI = AI + WBI;
					*PBR = AR - WBR;
					*PBI = AI - WBI;
				}
			}
	}
}

//===== ������������ ������������ ������������������ �� �� �������. ��������� � ������� X. M - ������� ��������������.
void RFFT_I(float *X, const float *W, int M)
{
	const int N = 1 << M;
	const float scale = (float)(1) / N;
	int step, szgr, ngr, G, G2, stgr, i, j;
	float *PAR, *PBR, *PAI, *PBI, AR, AI, BR, BI, WR, WI, AMBR, AMBI;
	for (step = M - 1, szgr = 1; step >= 0; step--, szgr <<= 1)
	{
		if (szgr == 1)
		{
			PAR = X;
			PBR = X + 1;
			AR = *PAR;
			BR = *PBR;
			*PAR = AR + BR;
			*PBR = AR - BR;
		}
		else
		{
			i = szgr >> 1;
			for (j = 0; j < i; j++)
			{
				PAR = X + j;
				PBR = PAR + szgr;
				AR = *PAR;
				BR = 2 * (*PBR);
				*PAR = AR + BR;
				*PBR = AR - BR;
			}
			for (j = i; j < szgr; j++)
			{
				PAR = X + j;
				PBR = PAR + szgr;
				AR = *PAR;
				BR = 2 * (*PBR);
				*PAR = AR - BR;
				*PBR = AR + BR;
			}
		}
		for (G = (szgr << 1), stgr = 2, G2 = (szgr << 2), ngr = 1; G <= N / 4;
			 G <<= 1, stgr <<= 1, G2 <<= 1, ngr <<= 1)
			for (i = 0; i < ngr; i++)
			{
				WR = W[stgr + i];
				WI = W[stgr + i + ngr];
				for (j = 0; j < szgr; j++)
				{
					PAR = X + G2 + (i << (M - step)) + j;
					PBR = PAR + szgr;
					PAI = PAR + G;
					PBI = PBR + G;
					AR = *PAR;
					AI = *PAI;
					BR = *PBR;
					BI = *PBI;
					*PAR = AR + BR;
					*PAI = AI + BI;
					AMBR = AR - BR;
					AMBI = AI - BI;
					*PBR = AMBR * WR + AMBI * WI;
					*PBI = AMBI * WR - AMBR * WI;
				}
			}
	}
	for (i = 0; i < N; i++)
		X[i] *= scale;
}

//===== ����������� ������ X �� ������, ���������� ����������� �� �������� S. ��������� � ������� X. M - ������� ��������������.
void MultConj(float *X, const float *S, int M)
{
	int i, j, st1, PXR, PXI;
	float XR, XI, SR, SI;
	const int N = 1 << M;
	X[0] *= S[0];
	X[1] *= S[1];
	for (i = 2, st1 = 1; i < N; i <<= 1, st1 <<= 1)
		for (j = 0; j < st1; j++)
		{
			PXR = i + j;
			PXI = PXR + st1;
			XR = X[PXR];
			XI = X[PXI];
			SR = S[PXR];
			SI = S[PXI];
			X[PXR] = XR * SR + XI * SI;
			X[PXI] = XI * SR - XR * SI;
		}
}

//===== ����������� ������ X �� �������� S. ��������� � ������� X. M - ������� ��������������.
void Mult(float *X, const float *S, int M)
{
	int i, j, st1, PXR, PXI;
	float XR, XI, SR, SI;
	const int N = 1 << M;
	X[0] *= S[0];
	X[1] *= S[1];
	for (i = 2, st1 = 1; i < N; i <<= 1, st1 <<= 1)
		for (j = 0; j < st1; j++)
		{
			PXR = i + j;
			PXI = PXR + st1;
			XR = X[PXR];
			XI = X[PXI];
			SR = S[PXR];
			SI = S[PXI];
			X[PXR] = XR * SR - XI * SI;
			X[PXI] = XI * SR + XR * SI;
		}
}

//===== ������������� ������ �� ����������� ������� �� �������
void InternalToExternalFormat(const float *x, float *re, float *im, int m)
{
	const uint n = 1 << m, hi = 1 << (m - 1);
	re[0] = x[0];
	im[0] = 0;
	re[hi] = x[1];
	im[hi] = 0;
	uint i, j, k, u, v, r = hi >> 1;
	for (i = 2, u = 1, v = hi; i < n; i <<= 1, u <<= 1, v >>= 1)
	{
		for (j = 0; j < u; j++)
		{
			k = i + j;
			if (r > hi)
			{
				re[n - r] = x[k];
				im[n - r] = x[k + u];
			}
			else
			{
				re[r] = x[k];
				im[r] = x[k + u];
			}
			r = IncRev(r, hi);
		}
		r = IncRev(r, v);
	}
}

//===== ��������� ������ ������������ ������������������ (���������� x ��������)
inline void FFT(float *X, float *Re, float *Im, float *W, int M)
{
	FFT_I(X, W, M);
	InternalToExternalFormat(X, Re, Im, M);
}

//======= �������
 void CONV(float *X, float *W, float *S, int M)
{
	CalcExps(W, M);
	FFT_I(X, W, M);
	FFT_I(S, W, M);
	Mult(X, S, M);
	RFFT_I(X, W, M);
}

//===== ����������
 void CORR(float *X, float *W, float *S, int M)
{
	CalcExps(W, M);
	FFT_I(X, W, M);
	FFT_I(S, W, M);
	MultConj(X, S, M);
	RFFT_I(X, W, M);
}
