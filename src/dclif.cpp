#include <mpi.h>

#include <cassert>
#include <cstring>

#include <condition_variable>
#include <map>
#include <mutex>
#include <queue>
#include <thread>

#include <unistd.h>

#include "dclif.h"

#define LOG if (0)

namespace {
	const int TAG_DUMP=1;
	const int TAG_STOP=2;
	int rank, size;
	std::mutex m;
	std::condition_variable cv;
	std::map<std::string, std::pair<int, int> > int32s;
	std::map<std::string, std::pair<double, int> > real64s;
	std::map<std::string, std::pair<std::string, int> > strings;
	std::map<std::string, std::pair<std::pair<void *, size_t>, int> >
		blobs;
	std::queue<std::pair<std::string, std::function<void ()> > > ready_queue;
	std::vector<std::tuple<
		std::string,
		std::vector<std::string>,
		std::function<void ()>
	> > notready_vector;
	size_t running_jobs = 0;
	std::vector<std::thread> threads;
	bool stop_requested = false;
	std::queue<MPI_Request> send_requests;
}

int get_rank() { return rank; }

void send_int32(int dest_rank, const std::string &name, int value) {
	if (dest_rank == rank)
		return;
    // Формируем буфер: name\0int32\0value (4 байта)
    std::vector<char> buffer;
    buffer.insert(buffer.end(), name.begin(), name.end());
    buffer.push_back('\0');
    const char* type = "int32";
    buffer.insert(buffer.end(), type, type + 5);
    buffer.push_back('\0');
    const char* value_ptr = reinterpret_cast<const char*>(&value);
    buffer.insert(buffer.end(), value_ptr, value_ptr + sizeof(value));

	LOG fprintf(stderr, "%d: sending %s=%d to %d\n", rank, name.c_str(), value, dest_rank);
    MPI_Send(buffer.data(), buffer.size(), MPI_BYTE, dest_rank, TAG_DUMP, MPI_COMM_WORLD);
}

void send_real64(int dest_rank, const std::string &name, double value) {
	if (dest_rank == rank)
		return;
    // Формируем буфер: name\0real64\0value (4 байта)
    std::vector<char> buffer;
    buffer.insert(buffer.end(), name.begin(), name.end());
    buffer.push_back('\0');
    const char* type = "real64";
    buffer.insert(buffer.end(), type, type + 6);
    buffer.push_back('\0');
    const char* value_ptr = reinterpret_cast<const char*>(&value);
    buffer.insert(buffer.end(), value_ptr, value_ptr + sizeof(value));

    MPI_Send(buffer.data(), buffer.size(), MPI_BYTE, dest_rank, TAG_DUMP, MPI_COMM_WORLD);
}

void send_string(int rank, const std::string &name, const std::string &value);
void send_blob(int rank, const std::string &name, const void *ptr, size_t size);

int get_value_int32(const std::string &name) {
	std::lock_guard<std::mutex> lk(m);

	auto it = int32s.find(name);
	if (it == int32s.end()) {
		LOG fprintf(stderr, "value not found: %s (int32)\n", name.c_str());
		exit(1);
	}

	// TODO: decrease refs && cleanup

	return it->second.first;
}

double get_value_real64(const std::string &name);
std::string get_value_string(const std::string &name);
std::pair<const void *, size_t> get_value_blob(const std::string &name);

bool deps_resolved_(const std::vector<std::string> deps) {
	// already locked
	for (auto name : deps) {
		if (int32s.find(name) != int32s.end()
				|| real64s.find(name) != real64s.end()
				|| strings.find(name) != strings.end()
				|| blobs.find(name) != blobs.end())
			continue;

		return false;
	}

	return true;
}

void wait_for(const std::string &name) {
	std::unique_lock<std::mutex> lk(m);

	LOG fprintf(stderr, "%d: start wait for %s\n", rank, name.c_str());
	cv.wait(lk, [name]() {
		return deps_resolved_({name});
	});
	LOG fprintf(stderr, "%d: end wait for %s\n", rank, name.c_str());
}

void check_deps_(const std::string &name) {
	// already locked
	// check if there are actions, dependent on name, and move them
	// to ready queue if their deps are resolved
	for (size_t i=0; i<notready_vector.size(); i++) {
		auto trip = notready_vector.at(i);

		auto deps = std::get<1>(trip);
		if (deps_resolved_(deps)) {
			ready_queue.push(std::make_pair(
				std::get<0>(trip), std::get<2>(trip)));
			if (i+1 < notready_vector.size()) {
				notready_vector[i] = notready_vector[notready_vector.size()-1];
				notready_vector.pop_back();
				i--;
			}
		}
	}
}

void submit_int32(const std::string &name, int value, int usages_count) {
	LOG fprintf(stderr, "%d: submit int32 %s %d %d\n", rank, name.c_str(), value,
		usages_count);
	std::lock_guard<std::mutex> lk(m);

	if (int32s.find(name) != int32s.end())
		return; // already there

	int32s.insert(std::make_pair(name, std::make_pair(value, usages_count)));

	check_deps_(name);

	cv.notify_all();
}

void submit_real64(const std::string &name, double value, int usages_count) {
	fprintf(stderr, "not implemented %s:%d\n", __FILE__, __LINE__);
	exit(1);
}
// TODO add usages count
void submit_string(const std::string &name, const std::string &value) {
	fprintf(stderr, "not implemented %s:%d\n", __FILE__, __LINE__);
	exit(1);
}
void submit_blob(const std::string &name, const void *ptr, size_t size) {
	fprintf(stderr, "not implemented %s:%d\n", __FILE__, __LINE__);
	exit(1);
}

#include <iostream>
#include <string>
#include <cstdint>

void write_dump_int32(const std::string &name, int value) {
    // Записываем имя переменной и нуль-терминатор
    std::cout.write(name.data(), name.size());
    std::cout.put('\0');
    // Записываем тип "int32" и нуль-терминатор
    std::cout.write("int32", 5);
    std::cout.put('\0');
    // Записываем значение как 4 байта
    std::cout.write(reinterpret_cast<const char*>(&value), sizeof(value));
}

void write_dump_real64(const std::string &name, double value) {
    std::cout.write(name.data(), name.size());
    std::cout.put('\0');
    std::cout.write("real64", 6);
    std::cout.put('\0');
    std::cout.write(reinterpret_cast<const char*>(&value), sizeof(value));
}

void write_dump_string(const std::string &name, const std::string &value) {
    std::cout.write(name.data(), name.size());
    std::cout.put('\0');
    std::cout.write("string", 6);
    std::cout.put('\0');
    // Размер строки (uint64)
    std::uint64_t size = value.size();
    std::cout.write(reinterpret_cast<const char*>(&size), sizeof(size));
    // Сама строка без завершающего нуля
    std::cout.write(value.data(), size);
}

void write_dump_blob(const std::string &name,
                     const std::pair<const void *, size_t> &value) {
    std::cout.write(name.data(), name.size());
    std::cout.put('\0');
    std::cout.write("blob", 4);
    std::cout.put('\0');
    // Размер блоба (uint64)
    std::uint64_t size = static_cast<std::uint64_t>(value.second);
    std::cout.write(reinterpret_cast<const char*>(&size), sizeof(size));
    // Данные блоба
    std::cout.write(reinterpret_cast<const char*>(value.first), size);
}

void enqueue(int op_rank, const std::string op_name,
		const std::vector<std::string> &deps,
		std::function<void ()> action) {
	if (rank != op_rank%size)
		return; // not our node

	std::lock_guard<std::mutex> lk(m);

	if (deps_resolved_(deps))
		ready_queue.push(std::make_pair(op_name, action));
	else
		notready_vector.push_back(std::make_tuple(op_name, deps, action));

	LOG fprintf(stderr, "%d: submited job: %s\n", rank, op_name.c_str());
	cv.notify_all();
}

bool finished_() {
	// already locked
	return notready_vector.empty()
		&& ready_queue.empty()
		&& running_jobs == 0;
}

void init_dclif_ops();
void read_inputs();
void write_outputs();

void join() {
	{
		std::unique_lock<std::mutex> lk(m);

	//	cv.wait(lk, finished_);

		stop_requested = true;
		cv.notify_all();
	}

	MPI_Send(nullptr, 0, MPI_BYTE, rank, TAG_STOP, MPI_COMM_WORLD);

	for (size_t i=0; i<threads.size(); i++) {
		threads[i].join();
	}
}

void thread_routine() {
	// process ready_queue, since notready_queue is handled elsewhere
	std::unique_lock<std::mutex> lk(m);

	while (!stop_requested) {
		LOG fprintf(stderr, "%d: thread wait start\n", rank);
		cv.wait(lk, []() {
			return stop_requested || !ready_queue.empty();
		});
		LOG fprintf(stderr, "%d: thread awake: rq.size=%d sr=%s\n",
			rank, (int)ready_queue.size(), stop_requested? "true": "false");

		if (!ready_queue.empty()) {
			auto item = ready_queue.front();
			ready_queue.pop();

			running_jobs++;
			lk.unlock();

			item.second();

			lk.lock();
			assert(running_jobs > 0);
			running_jobs--;
			cv.notify_all();
			continue;
		}

		// no jobs here, so on stop_requested we'll quit
	}
}

void sender_thread() {
	std::unique_lock<std::mutex> lk(m);

	while (!stop_requested) {
		cv.wait(lk, []() {
			return stop_requested || !send_requests.empty();
		});

		if (!send_requests.empty()) {
			MPI_Request item = send_requests.front();
			send_requests.pop();

			running_jobs++;
			lk.unlock();

			MPI_Wait(&item, MPI_STATUS_IGNORE);

			lk.lock();
			assert(running_jobs > 0);
			running_jobs--;
			cv.notify_all();
			continue;
		}
	}
}

void receiver_thread() {
    std::unique_lock<std::mutex> lk(m);

    while (!stop_requested) {
        lk.unlock();

        MPI_Status status;
        MPI_Probe(MPI_ANY_SOURCE, MPI_ANY_TAG, MPI_COMM_WORLD, &status);

        int count;
        MPI_Get_count(&status, MPI_BYTE, &count);
        std::vector<char> buffer(count);
        MPI_Recv(buffer.data(), count, MPI_BYTE, status.MPI_SOURCE,
                 status.MPI_TAG, MPI_COMM_WORLD, &status);

        if (status.MPI_TAG == TAG_STOP) {
            break;
        } else if (status.MPI_TAG == TAG_DUMP) {
            const char* ptr = buffer.data();
            const char* end = buffer.data() + count;

            // read name (null-terminated)
            std::string name;
            while (ptr < end && *ptr != '\0')
                name.push_back(*ptr++);
            if (ptr == end || *ptr != '\0') {
                fprintf(stderr, "receiver: malformed message (name)\n");
				exit(1);
                lk.lock();
                continue;
            }
            ++ptr; // skip '\0'

            // read type (null-terminated)
            std::string type;
            while (ptr < end && *ptr != '\0')
                type.push_back(*ptr++);
            if (ptr == end || *ptr != '\0') {
                fprintf(stderr, "receiver: malformed message (type)\n");
				exit(1);
                lk.lock();
                continue;
            }
            ++ptr; // skip '\0'

            if (type == "int32") {
                if (ptr + 4 > end) {
                    fprintf(stderr, "receiver: insufficient data for int32\n");
					exit(1);
                    lk.lock();
                    continue;
                }
                int value;
                memcpy(&value, ptr, 4);
				LOG fprintf(stderr, "%d: received %s=%d from rank %d\n", rank, name.c_str(), value, status.MPI_SOURCE);
                submit_int32(name, value, -1);
            } else if (type == "real64") {
                if (ptr + 8 > end) {
                    fprintf(stderr, "receiver: insufficient data for real64\n");
					exit(1);
                    lk.lock();
                    continue;
                }
                double value;
                memcpy(&value, ptr, 8);
                submit_real64(name, value, -1);
            } else if (type == "string") {
                if (ptr + 8 > end) {
                    fprintf(stderr, "receiver: insufficient data for string size\n");
					exit(1);
                    lk.lock();
                    continue;
                }
                uint64_t size;
                memcpy(&size, ptr, 8);
                ptr += 8;
                if (ptr + size > end) {
                    fprintf(stderr, "receiver: insufficient data for string content\n");
					exit(1);
                    lk.lock();
                    continue;
                }
                std::string value(ptr, size);
                submit_string(name, value);
            } else if (type == "blob") {
                if (ptr + 8 > end) {
                    fprintf(stderr, "receiver: insufficient data for blob size\n");
					exit(1);
                    lk.lock();
                    continue;
                }
                uint64_t size;
                memcpy(&size, ptr, 8);
                ptr += 8;
                if (ptr + size > end) {
                    fprintf(stderr, "receiver: insufficient data for blob content\n");
					exit(1);
                    lk.lock();
                    continue;
                }
                submit_blob(name, ptr, size);
            } else {
                fprintf(stderr, "receiver: unknown type %s\n", type.c_str());
				exit(1);
            }
        } else {
            fprintf(stderr, "receiver: unknown tag %d\n", status.MPI_TAG);
			exit(1);
        }

        lk.lock();
    }
}

void start_threads(size_t threads_count = 4) {
	assert(threads.empty());
	assert(threads_count > 0);
	threads.reserve(threads_count+2);

	for (size_t i=0; i<threads_count; i++)
		threads.emplace_back(thread_routine);

	threads.emplace_back(receiver_thread);
	threads.emplace_back(sender_thread);
}

int dclif_main(int *argc, char ***argv) {
	int provided, desired=MPI_THREAD_MULTIPLE;
	MPI_Init_thread(argc, argv, desired, &provided);
	if (desired != provided) {
		fprintf(stderr, "MPI thread safety level not provided: %d < %d\n",
			provided, desired);
		return 1;
	}
	MPI_Comm_rank(MPI_COMM_WORLD, &rank);
	MPI_Comm_size(MPI_COMM_WORLD, &size);

	LOG fprintf(stderr, "%d: started process, MPI_SIZE=%d\n", rank, size);

	init_dclif_ops();
	LOG fprintf(stderr, "%d: reading inputs...\n", rank);

	read_inputs();
	LOG fprintf(stderr, "%d: int32s.size=%d\n", rank, (int)int32s.size());

	start_threads();

	write_outputs();

	join();

	MPI_Finalize();

	return 0;
}
