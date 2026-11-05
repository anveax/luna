#include <string>
#include <vector>
#include <functional>

int get_rank();

void wait_for(const std::string &name);

int get_value_int32(const std::string &name);
double get_value_real64(const std::string &name);
std::string get_value_string(const std::string &name);
std::pair<const void *, size_t> get_value_blob(const std::string &name);

void submit_int32(const std::string &name, int value, int usages_count);
void submit_real64(const std::string &name, double value, int usages_count);
void submit_string(const std::string &name, const std::string &value,
	int usages_count);
void submit_blob(const std::string &name, const void *ptr, size_t size,
	int usages_count);

void send_int32(int rank, const std::string &name, int value);
void send_real64(int rank, const std::string &name, double value);
void send_string(int rank, const std::string &name, const std::string &value);
void send_blob(int rank, const std::string &name, const void *ptr, size_t size);

void write_dump_int32(const std::string &name, int value);
void write_dump_real64(const std::string &name, double value);
void write_dump_string(const std::string &name, const std::string &value);
void write_dump_blob(const std::string &name,
	const std::pair<const void *, size_t> &value);

void enqueue(int rank, const std::string op_name,
	const std::vector<std::string> &deps,
	std::function<void ()> action);

int dclif_main(int *argc, char ***argv);
