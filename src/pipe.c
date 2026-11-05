#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>

void pipe_exec(const char *path, int *pin, int *pout) {
	int stdin_pipe[2], stdout_pipe[2];
	pid_t pid;
	char* buffer = NULL;
	size_t total_bytes = 0;
	char **no_args = (char**)malloc(sizeof(char*));
	no_args[0] = NULL;

	// Создаём пайпы для stdin и stdout
	pipe(stdin_pipe);
	pipe(stdout_pipe);

	// Создаём дочерний процесс
	pid = fork();

	if (pid == 0) { // Дочерний процесс
		// Перенаправляем стандартные потоки
		dup2(stdin_pipe[0], STDIN_FILENO);
		dup2(stdout_pipe[1], STDOUT_FILENO);

		// Закрываем ненужные дескрипторы
		close(stdin_pipe[0]);
		close(stdin_pipe[1]);
		close(stdout_pipe[0]);
		close(stdout_pipe[1]);

		// Запускаем целевую программу
		execvp(path, no_args);
		perror("execvp");
		exit(EXIT_FAILURE);
	} else { // Родительский процесс
		// Закрываем ненужные концы пайпов
		close(stdin_pipe[0]);
		close(stdout_pipe[1]);

		*pin = stdin_pipe[1];
		*pout = stdout_pipe[0];

		return;
	}
}


