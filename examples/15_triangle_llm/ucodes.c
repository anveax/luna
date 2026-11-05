#include <math.h>
#include <stdio.h>
#define M_PI 3.14159265358979323846

// op1: Вычисление периметра
void op1(double a, double b, double c, double *P) {
    *P = a + b + c;
}

// op2: Вычисление полупериметра
void op2(double P, double *p) {
    *p = P / 2.0;
}

// op3: Формула Герона (площадь)
void op3(double a, double b, double c, double p, double *S) {
    *S = sqrt(p * (p - a) * (p - b) * (p - c));
}

// op4: Площадь через основание и высоту
void op4(double a, double h_a, double *S) {
    *S = 0.5 * a * h_a;
}

// op5: Высота через площадь и основание
void op5(double S, double a, double *h_a) {
    *h_a = (2.0 * S) / a;
}

// op6: Теорема Пифагора (гипотенуза)
void op6(double a, double b, double *c) {
    *c = sqrt(a*a + b*b);
}

// op7: Теорема синусов (сторона)
void op7(double angleA, double angleB, double b, double *a) {
    *a = b * sin(angleA) / sin(angleB);
}

// op8: Теорема косинусов (сторона)
void op8(double a, double b, double angleC, double *c) {
    *c = sqrt(a*a + b*b - 2*a*b*cos(angleC));
}

// op9: Теорема косинусов (угол)
void op9(double a, double b, double c, double *angleC) {
    double cosC = (a*a + b*b - c*c) / (2*a*b);
    *angleC = acos(cosC);
}

// op10: Сумма углов треугольника
void op10(double angleA, double angleB, double *angleC) {
    *angleC = M_PI - angleA - angleB;
}

// op11: Радиус вписанной окружности
void op11(double S, double p, double *r) {
    *r = S / p;
}

// op12: Радиус описанной окружности (через стороны)
void op12(double a, double b, double c, double S, double *R) {
    *R = (a * b * c) / (4 * S);
}

// op13: Медиана к стороне a
void op13(double a, double b, double c, double *med_a) {
    *med_a = 0.5 * sqrt(2*b*b + 2*c*c - a*a);
}

// op14: Биссектриса угла A
void op14(double b, double c, double angleA, double *bis_a) {
    *bis_a = (2 * b * c * cos(angleA/2)) / (b + c);
}

// op15: Радиус описанной окружности (через угол)
void op15(double a, double angleA, double *R) {
    *R = a / (2 * sin(angleA));
}

// op16: Высота к стороне b
void op16(double S, double b, double *h_b) {
    *h_b = (2.0 * S) / b;
}

// op17: Высота к стороне c
void op17(double S, double c, double *h_c) {
    *h_c = (2.0 * S) / c;
}

// op18: Медиана к стороне b
void op18(double a, double b, double c, double *med_b) {
    *med_b = 0.5 * sqrt(2*a*a + 2*c*c - b*b);
}

// op19: Медиана к стороне c
void op19(double a, double b, double c, double *med_c) {
    *med_c = 0.5 * sqrt(2*a*a + 2*b*b - c*c);
}

// op20: Биссектриса угла B
void op20(double a, double c, double angleB, double *bis_b) {
    *bis_b = (2 * a * c * cos(angleB/2)) / (a + c);
}

// op21: Биссектриса угла C
void op21(double a, double b, double angleC, double *bis_c) {
    *bis_c = (2 * a * b * cos(angleC/2)) / (a + b);
}

// op22: Площадь через стороны и угол
void op22(double a, double b, double angleC, double *S) {
    *S = 0.5 * a * b * sin(angleC);
}

// op23: Радиус вписанной окружности (прямоугольный треугольник)
void op23(double a, double b, double c, double *r) {
    *r = (a + b - c) / 2.0;
}
