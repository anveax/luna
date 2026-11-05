#include <assert.h>
#include <float.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "clif.h"

const char *buf;
size_t buf_size;

#include <stdlib.h>
#include <string.h>
#include <unistd.h>   // для rmdir, mkdtemp

/**
 * Создаёт уникальную временную директорию безопасным способом.
 * Директория создаётся с помощью mkdtemp, гарантирующего отсутствие
 * конфликтов имён.
 *
 * Возвращает указатель на строку с путём к созданной директории,
 * выделенную через malloc(). В случае ошибки возвращает NULL.
 */
const char *create_temp_dir(void) {
    // Шаблон для mkdtemp — изменяемый массив
    char templ[] = "/tmp/tempdir.XXXXXX";

    // mkdtemp модифицирует templ, заменяя XXXXXX уникальным суффиксом,
    // и создаёт директорию с правами 0700.
    if (mkdtemp(templ) == NULL) {
        return NULL;  // ошибка создания директории
    }

    // Копируем полученный путь в динамическую память
    char *path = strdup(templ);
    if (path == NULL) {
        // Если не удалось выделить память, удаляем уже созданную папку,
        // чтобы не оставлять мусор в файловой системе.
        rmdir(templ);
        return NULL;
    }

    return path;
}

void delete_temp_dir(const char *path) {
    // Формируем команду: rm -rf "path"
    char command[1024];
    snprintf(command, sizeof(command), "rm -rf \"%s\"", path);
    system(command);  // выполняем удаление

    free((void*)path); // освобождаем память, выделенную create_temp_dir()
}


void read_stdin(void **out_buf, size_t *out_size) {
	size_t size = 4096;
	void *buf = malloc(size);
	size_t offset=0;

	while (!feof(stdin)) {
		if (offset == size) {
			buf = realloc(buf, size + 4096);
			size += 4096;
		}
		size_t count = fread(((char*)buf) + offset, 1, size-offset, stdin);
		offset += count;
	}

	*out_buf = buf;
	*out_size = offset;
}

void read_stdin_string(char **out) {
    size_t size = 128;   // начальный размер буфера
    size_t len = 0;      // текущая длина прочитанных данных (без завершающего нуля)
    char *buf = (char *)malloc(size);
    if (!buf) {
        *out = NULL;
        return;
    }

    int c;
    while ((c = getchar()) != EOF) {
        // Если места не хватает, расширяем буфер в два раза
        if (len + 1 >= size) {
            size *= 2;
            char *new_buf = (char *)realloc(buf, size);
            if (!new_buf) {
                free(buf);
                *out = NULL;
                return;
            }
            buf = new_buf;
        }
        buf[len++] = (char)c;
    }

    // Добавляем завершающий нуль
    buf[len] = '\0';
    *out = buf;
}

void read_stdin_int32(int *out) {
	fread(out, sizeof(*out), 1, stdin);
}

void read_stdin_real64(double *out) {
	fread(out, sizeof(*out), 1, stdin);
}

void read_stdin_blob(void **data, size_t *data_size) {
    size_t size = 128;   // начальный размер буфера
    size_t len = 0;      // текущая длина прочитанных данных (без завершающего нуля)
    char *buf = (char *)malloc(size);
    if (!buf) {
        *data = NULL;
        return;
    }

    int c;
    while ((c = getchar()) != EOF) {
        // Если места не хватает, расширяем буфер в два раза
        if (len >= size) {
            size *= 2;
            char *new_buf = (char *)realloc(buf, size);
            if (!new_buf) {
                free(buf);
                *data = NULL;
                return;
            }
            buf = new_buf;
        }
        buf[len++] = (char)c;
    }

    // Добавляем завершающий нуль
    *data = buf;
	*data_size = len;
}

#include <unistd.h>
#include <stdlib.h>

void read_file_blob(int pout, void **data, size_t *size)
{
    // Начальная ёмкость буфера
    size_t capacity = 4096;
    void *buf = malloc(capacity);
    if (!buf) {
        *data = NULL;
        *size = 0;
        return;
    }

    size_t total = 0;   // сколько байт уже прочитано

    while (1) {
        // Увеличиваем буфер, если нужно
        if (total == capacity) {
            capacity *= 2;
            void *new_buf = realloc(buf, capacity);
            if (!new_buf) {
                free(buf);
                *data = NULL;
                *size = 0;
                return;
            }
            buf = new_buf;
        }

        // Читаем очередную порцию
        ssize_t n = read(pout, (char*)buf + total, capacity - total);
        if (n == 0) {
            // Конец файла
            break;
        }
        if (n < 0) {
            // Ошибка чтения
            free(buf);
            *data = NULL;
            *size = 0;
            return;
        }

        total += n;
    }

    // Необязательно: уменьшаем буфер до точного размера
    if (total < capacity) {
        void *new_buf = realloc(buf, total);
        if (new_buf) {
            buf = new_buf;
        }
        // Если realloc не удался, оставляем буфер большего размера – это не критично
    }

    *data = buf;
    *size = total;
}

const char **parse_stdin_lines() {
	void *buf;
	size_t size;
	char *ptr;
	size_t count_lines;
	size_t i;
	char **result;
	size_t line_idx;
	size_t begin;
	read_stdin(&buf, &size);
	ptr = (char*)buf;
	assert(size > 0);
	assert(ptr[size-1] == '\n');

	count_lines = 0;
	for (i=0; i<size; i++) {
		if (ptr[i] == '\n')
			count_lines++;
	}

	result = (char**)malloc((count_lines+1) * sizeof(char*));

	result[0] = &ptr[0];
	line_idx = 0;
	begin = 0;
	for (i=1; i<size; i++) {
		if (ptr[i] == '\n') {
			result[line_idx++] = &ptr[begin];
			ptr[i] = '\0';
			begin = i+1;
		}
	}

	return (const char **)result;
}

int parse_int32(const char *str) {
	if (str == NULL || strlen(str) == 0) {
		fprintf(stderr, "string NULL or empty\n");
		exit(1);
	}
	return strtol(str, NULL, 10);
}

long long parse_int64(const char *str) {
	if (str == NULL || strlen(str) == 0) {
		fprintf(stderr, "string NULL or empty\n");
		exit(1);
	}
	return strtoll(str, NULL, 10);
}

char *parse_string(const char *str) {
	return (char *)str;
}

float parse_real32(const char *str) {
	if (str == NULL || strlen(str) == 0) {
		fprintf(stderr, "string NULL or empty\n");
		exit(1);
	}
	return strtof(str, NULL);
}

double parse_real64(const char *str) {
	if (str == NULL || strlen(str) == 0) {
		fprintf(stderr, "string NULL or empty\n");
		exit(1);
	}
	return strtod(str, NULL);
}

void write_line_int32(int value) {
	printf("%d\n", value);
}

void write_line_int64(long long value) {
	printf("%lld\n", value);
}

void write_line_real32(float value) {
	printf("%f\n", value);
}

void write_line_real64(double value) {
	printf("%.*g\n", DBL_DECIMAL_DIG, value);
}

void write_line_string(const char *value) {
	printf("%s\n", value);
}

void read_path_blob(const char *path, void **blob, size_t *blob_size) {
	FILE *f = fopen(path, "rb");
	long size;
	if (!f) {
		fprintf(stderr, "failed to read blob from file %s\n", path);
		exit(1);
	}
	fseek(f, 0, SEEK_END);
	size = ftell(f);
	fseek(f, 0, SEEK_SET);

	*blob = malloc(size);
	*blob_size = size;

	fread(*blob, 1, size, f);
	fclose(f);
}

void write_path_blob(const char *path, const void *blob, size_t size) {
	FILE *f = fopen(path, "wb");
	fwrite(blob, 1, size, f);
	fclose(f);
}

void dump(const char *name, const char *type, const void *data,
		size_t size) {
	FILE *f;
	char buf[1024];

	sprintf(buf, "_dump_%s_%s", name, type);
	f = fopen(buf, "wb");
	fwrite(data, 1, size, f);
	fclose(f);
}

void write_path_int32(const char *path, int val) {
	return write_path_blob(path, &val, sizeof(val));
}

void dump_int32(const char *name, int val) {
	return dump(name, "int32", &val, sizeof(val));
}

void dump_real64(const char *name, double val) {
	return dump(name, "real64", &val, sizeof(val));
}

void dump_string(const char *name, const char *val) {
	return dump(name, "string", &val, strlen(val));
}

void dump_blob(const char *name, const void *data, size_t size) {
	return dump(name, "blob", data, size);
}
