#include <unistd.h>
#include <string.h>
#include <stdio.h>
#include <sys/wait.h>
#include <stdlib.h>
#include <errno.h>

void pipe_exec(const char *, int *, int *);

int main() {
	int pin, pout;
	char *data = "one\ntwo\nthree\nfour\n";
	int len;
	int ofs;
	void *buf;
	len = strlen(data);
	buf = malloc(len);
	pipe_exec("sort", &pin, &pout);

	write(pin, data, len);
	close(pin);
	
//	waitpid(pid, NULL, 0);

	ofs = 0;
	while (ofs < len) {
		int count;
		count = read(pout, buf + ofs, len-ofs);
		if (count == -1) {
			printf("errno is %d\n", errno);
			exit(1);
		}
		printf("count %d, ofs %d, len %d\n", (int)count,
			(int)ofs, (int)len);
		ofs += count;
		if (count == 0)
			break;
	}
	printf("result: \"%s\"\n", (char*)buf);
	return 0;
}
