const { get_data_transfer_time, get_average_data_transfer_time } =
    require('./computer_info.js');

/////   //////  Heterogeneous earliest finish time (HEFT) 
/////   GET RANKS 
function calculate_rank(operation_id, operations) {
    var operation = operations[parseInt(operation_id)];

    if (operation.rank != -1)
        return operation.rank;

    var max = 0;
    if (operation.children.length > 0) {
        for (var child_id of operation.children) {
            var child_rank = operations[child_id].rank;
            if (child_rank == -1) {
                child_rank = calculate_rank(child_id, operations);
            }
            if (child_rank + get_average_data_transfer_time() > max) {
                max = child_rank + get_average_data_transfer_time();
            }
        }
    }
    var rank = operation.weight + max;
    operation.rank = rank;
    return rank;
}


/////   SORT OPERATIONS BY RANKS 
function sort_operations_by_rank(operations) {
    var map_task_rank = [];
    for (var operation of operations) {
        map_task_rank.push({ "operation_id": operation.id, "rank": operation.rank });
    }

    const compareFn = (a, b) => b.rank - a.rank;
    map_task_rank.sort(compareFn);

    var operations_ordered_by_rank = [];
    map_task_rank.forEach((element) => {
        operations_ordered_by_rank.push(parseInt(element.operation_id));
    });
    return operations_ordered_by_rank;
}

/////   SCHEDULE
var schedule = [];

///// PLANNING
function calculate_finish_time(operation_id, operations,
    parents_completed_time, proc_id, processors) {

    var operation = operations[operation_id];
    var processor = processors[proc_id];

    var start_time = Math.max(processor.release_time, parents_completed_time);
    var finish_time = start_time + operation.weight;

    var total_data_transfer_time = 0;
    // var max_data_transfer_time = 0;

    var data_transfer_time_from_proc = Array.from({ length: processors.length }, () => 0);
    if (operation.parents.length > 0) {
        for (var parent_id of operation.parents) {
            var parent_proc_id = schedule[parent_id].processor_id;
            data_transfer_time_from_proc[parent_proc_id] += get_data_transfer_time(parent_proc_id, proc_id);

            // if (parent_proc_id != proc_id) {
            //     var data_transfer_time = get_data_transfer_time(parent_proc_id, proc_id);
            //     total_data_transfer_time += data_transfer_time;
            //     if (data_transfer_time > max_data_transfer_time)
            //         max_data_transfer_time = data_transfer_time;
            // }
        }
    }
    total_data_transfer_time = Math.max(...data_transfer_time_from_proc);
    finish_time += total_data_transfer_time;
    return { start_time, finish_time };
}

function find_optimal_proc(finish_times, parents_per_proc) {
    ///// get the minimum execution time of operation
    const earliest_finish_time = Math.min(...finish_times);
    ///// get indices of all nodes with minimum time
    const candidates = finish_times.reduce((acc, time, idx) =>
        time === earliest_finish_time ? [...acc, idx] : acc, []
    );
    ///// sort candidates by descending number of parents
    candidates.sort((a, b) => parents_per_proc[b] - parents_per_proc[a]);
    return candidates[0];
}


function planning_operation(operation_id, operations, processors) {
    var operation = operations[operation_id];

    ///// calculate the completion time of parent operations
    var parents_completed_time = 0;
    for (var parent_id of operation.parents) {
        parents_completed_time = Math.max(parents_completed_time, schedule[parent_id].finish_time);
    }

    ///// calculate start and finish time for all processors
    var start_times = [];
    var finish_times = [];
    for (var proc_id in processors) {
        var { start_time, finish_time } = calculate_finish_time(operation_id, operations,
            parents_completed_time, proc_id, processors);
        start_times.push(start_time);
        finish_times.push(finish_time);
    }

    ///// get the number of parent operations on each processor
    var parents_per_proc = Array.from({ length: processors.length }, () => 0);
    if (operation.parents.length > 0) {
        for (var parent_id of operation.parents) {
            var parent_proc_id = schedule[parent_id].processor_id;
            parents_per_proc[parent_proc_id]++;
        }
    }

    var target_proc_id = find_optimal_proc(finish_times, parents_per_proc);
    var earliest_finish_time = finish_times[target_proc_id];

    ///// save result of planning
    schedule[operation_id] = {
        operation_id: parseInt(operation_id),
        processor_id: parseInt(target_proc_id),
        start_time: parseInt(start_times[target_proc_id]),
        finish_time: parseInt(earliest_finish_time),
    };
    // console.log("Operation ", operations[operation_id].name, " is planned.");

    ///// update processor's release time
    processors[target_proc_id].release_time = earliest_finish_time;

    return schedule[operation_id];
}


function heft(operations, processors) {
    /////   GET RANKS 
    for (var operation_id in operations) {
        calculate_rank(operation_id, operations);
        // console.log("operation ", operations[operation_id].name, ": rank = ", operations[operation_id].rank);
    }

    /////   SORT OPERATIONS BY RANKS 
    var operations_ordered_by_rank = sort_operations_by_rank(operations);
    // let operations_ordered_by_rank_for_log = operations_ordered_by_rank.map(op => operations[op].name);
    // console.log(operations_ordered_by_rank_for_log);

    /// PLANNING
    for (var operation_id of operations_ordered_by_rank) {
        planning_operation(operation_id, operations, processors);
    }

    for (var elem of schedule) {
        elem.operation_id = operations[elem.operation_id].name;
    }
    return schedule;
}

module.exports = { heft };
