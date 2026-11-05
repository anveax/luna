#include <stddef.h>

const char **parse_stdin_lines();

// Helpers for different types (default C formats are used)

const char *create_temp_dir();
void delete_temp_dir(const char *path);

int parse_int32(const char *);
double parse_real64(const char *);
char *parse_string(const char *);

void write_line_int32(int);
void write_line_real64(double);
void write_line_string(const char *);

void read_path_blob(const char *path, void **blob, size_t *blob_size);
void write_path_blob(const char *path, const void *blob, size_t size);
void write_path_int32(const char *path, int val);

void read_stdin_int32(int *);
void read_stdin_real64(double *);
void read_stdin_string(char **);
void read_stdin_blob(void **, size_t *);

void read_file_blob(int pout, void **, size_t *);

void dump_int32(const char *name, int val);
void dump_real64(const char *name, double val);
void dump_string(const char *name, const char *string);
void dump_blob(const char *name, const void *data, size_t size);
