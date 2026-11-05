void cli_simple_init(const char *argspec);

int cli_simple_read_int(int idx);
float cli_simple_read_float(int idx);
double cli_simple_read_double(int idx);

void cli_simple_write_int(int);
void cli_simple_write_float(float);
void cli_simple_write_double(double);

void cli_simple_finalize();
