#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

// Внешние callback-функции (предполагается, что они определены в другом месте)
void on_input_int32(const char *name, int value);
void on_input_real64(const char *name, double value);
void on_input_string(const char *name, const char *value, size_t length);
void on_input_blob(const char *name, const void *data, size_t size);

// Вспомогательные функции для чтения бинарных данных в little-endian порядке
static void read_bytes(void *buf, size_t n) {
    if (fread(buf, 1, n, stdin) != n) {
        // Недостаточно данных — аварийный выход
        exit(1);
    }
}

static uint64_t read_uint64_le(void) {
    unsigned char buf[8];
    read_bytes(buf, 8);
    return (uint64_t)buf[0]       |
           ((uint64_t)buf[1] << 8)  |
           ((uint64_t)buf[2] << 16) |
           ((uint64_t)buf[3] << 24) |
           ((uint64_t)buf[4] << 32) |
           ((uint64_t)buf[5] << 40) |
           ((uint64_t)buf[6] << 48) |
           ((uint64_t)buf[7] << 56);
}

static int32_t read_int32_le(void) {
    unsigned char buf[4];
    read_bytes(buf, 4);
    return (int32_t)(buf[0] | (buf[1] << 8) | (buf[2] << 16) | (buf[3] << 24));
}

static double read_double_le(void) {
    uint64_t u = read_uint64_le();
    double d;
    memcpy(&d, &u, 8);
    return d;
}

// Основная функция чтения дампа
void read_inputs() {
    char name[4096];
    char type[4096];
    int c;
    size_t idx;

    while (1) {
        // Чтение имени переменной (до '\0')
        idx = 0;
        while ((c = fgetc(stdin)) != EOF && c != '\0') {
            if (idx < sizeof(name) - 1) name[idx++] = c;
        }
        if (c == EOF) break;          // Конец файла
        name[idx] = '\0';

        // Чтение типа (до '\0')
        idx = 0;
        while ((c = fgetc(stdin)) != EOF && c != '\0') {
            if (idx < sizeof(type) - 1) type[idx++] = c;
        }
        if (c == EOF) break;          // Некорректный дамп
        type[idx] = '\0';

		//fprintf(stderr, "got input %s %s\n", name, type);

        // Обработка в зависимости от типа
        if (strcmp(type, "int32") == 0) {
            int32_t val = read_int32_le();
            on_input_int32(name, val);
        }
        else if (strcmp(type, "real64") == 0) {
            double val = read_double_le();
            on_input_real64(name, val);
        }
        else if (strcmp(type, "string") == 0) {
            uint64_t size = read_uint64_le();
            char *data = (char*)malloc(size);
            if (!data) exit(1);
            read_bytes(data, size);
            on_input_string(name, data, size);
            free(data);
        }
        else if (strcmp(type, "blob") == 0) {
            uint64_t size = read_uint64_le();
            void *data = malloc(size);
            if (!data) exit(1);
            read_bytes(data, size);
            on_input_blob(name, data, size);
            free(data);
        }
        else {
            // Неподдерживаемый тип — завершаем работу
            break;
        }
    }
}
