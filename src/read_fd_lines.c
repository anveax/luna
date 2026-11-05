#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <errno.h>

static int read_fd(int fd, void **out_buf, size_t *out_size) {
    size_t chunk_size = 4096;
    size_t total_read = 0;
    char *buffer = (char *)malloc(chunk_size);
    if (!buffer) return -1;

    while (1) {
        if (total_read >= chunk_size) {
            char *new_buf = (char *)realloc(buffer, chunk_size + 4096);
            if (!new_buf) {
                free(buffer);
                return -1;
            }
            buffer = new_buf;
            chunk_size += 4096;
        }

        ssize_t n = read(fd, buffer + total_read, chunk_size - total_read);
        if (n < 0) {
            free(buffer);
            return -1;
        }
        if (n == 0) break;

        total_read += n;
    }

    /* Trim buffer to actual size and add null terminator */
    char *resized = (char *)realloc(buffer, total_read + 1);
    if (!resized) {
        free(buffer);
        return -1;
    }
    resized[total_read] = '\0';
    
    *out_buf = resized;
    *out_size = total_read;
    return 0;
}

const char **parse_fd_lines(int fd) {
    void *buf;
    size_t size;
    
    if (read_fd(fd, &buf, &size) != 0 || !buf)
        return NULL;

    char *ptr = (char *)buf;
    size_t lines = 0;
    int has_final_newline = (size > 0) ? (ptr[size-1] == '\n') : 0;

    /* Count lines */
    for (size_t i = 0; i < size; i++)
        if (ptr[i] == '\n') lines++;
    
    /* Account for last line without newline */
    if (size > 0 && !has_final_newline) lines++;

    /* Allocate array (+1 for NULL terminator) */
    const char **result = (const char **)malloc((lines + 1) * sizeof(const char*));
    if (!result) {
        free(buf);
        return NULL;
    }

    /* Split lines */
    size_t idx = 0;
    char *start = ptr;
    for (size_t i = 0; i < size; i++) {
        if (ptr[i] == '\n') {
            ptr[i] = '\0';
            result[idx++] = start;
            start = &ptr[i+1];
        }
    }

    /* Handle last line */
    if (start <= &ptr[size] && !has_final_newline && size > 0)
        result[idx++] = start;

    result[idx] = NULL;
    return result;
}

/* Пример использования:
   Не забудьте закрыть файловый дескриптор после использования!
   
   int fd = open("file.txt", O_RDONLY);
   const char **lines = parse_fd_lines(fd);
   // ... обработка ...
   free(lines);  // освобождает и буфер данных тоже
   close(fd);
*/
