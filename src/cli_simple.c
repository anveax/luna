#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

static char **args = NULL;
static size_t args_size = 0;

int parse_int(const char *str) {
	return strtol(str, NULL, 10);
}

float parse_float(const char *str) {
    return strtof(str, NULL);  // strtof для float
}

double parse_double(const char *str) {
    return strtod(str, NULL);  // strtod для double
}

static char* read_line() {
    size_t capacity = 16;
    char *buffer = malloc(capacity);
    size_t size = 0;
    int c;

    if (!buffer) return NULL;

    while ((c = getchar()) != '\n' && c != EOF) {
        if (size + 1 >= capacity) {
            capacity *= 2;
            char *new_buffer = realloc(buffer, capacity);
            if (!new_buffer) {
                free(buffer);
                return NULL;
            }
            buffer = new_buffer;
        }
        buffer[size++] = c;
    }

    buffer[size] = '\0';
    char *result = realloc(buffer, size + 1);
    return result ? result : buffer;
}

void parse_tokens(const char *str) {
    // Освобождаем предыдущий args
	assert(!args);

    // Создаем рабочую копию строки
    char *input = strdup(str);
    if (!input) return;

    // Первый проход: подсчет токенов '<'
    size_t count = 0;
    char *token = strtok(input, " ");
    while (token) {
        if (token[0] == '<') count++;
        token = strtok(NULL, " ");
    }

    // Выделяем память под массив + NULL
    args = malloc(count * sizeof(char*));
    if (!args) {
        free(input);
        return;
    }
	args_size = count;

    // Второй проход: заполнение аргументов
    free(input);
    input = strdup(str);
    if (!input) {
        free(args);
        args = NULL;
        return;
    }

    size_t index = 0;
    token = strtok(input, " ");
    while (token) {
        if (token[0] == '<') {
            char *line = read_line();
            if (!line) { // Если read_line вернула NULL, создаем пустую строку
                line = malloc(1);
                if (line) *line = '\0';
            }
            args[index++] = line;
        }
        token = strtok(NULL, " ");
    }

    free(input);
}

// format: "<int >int >int"
void cli_simple_init(const char *argspec)
{
	parse_tokens(argspec);
}

int cli_simple_read_int(int idx)
{
	assert(args != NULL);
	assert(idx >= 0);
	assert(idx < args_size);

	return parse_int(args[idx]);
}

float cli_simple_read_float(int idx)
{
	assert(args != NULL);
	assert(idx >= 0);
	assert(idx < args_size);

	return parse_float(args[idx]);
}

double cli_simple_read_double(int idx)
{
	assert(args != NULL);
	assert(idx >= 0);
	assert(idx < args_size);

	return parse_double(args[idx]);
}

void cli_simple_write_int(int value)
{
	printf("%d\n", value);
}


void cli_simple_write_float(float value)
{
	printf("%f\n", value);
}


void cli_simple_write_double(double value)
{
	printf("%lf\n", value);
}


void cli_simple_finalize()
{
	int i;
	for (i=0; i<args_size; i++)
		free(args[i]);
	free(args);
}
