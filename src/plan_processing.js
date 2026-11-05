const assert = require('assert');

const { nimpl } = require("./common.js");

function get_plan(jaz, plan_number) {
    assert("plan" in jaz, "The JAZ does not contain any plans.")
    var plan_name = "plan" + plan_number;
    assert(plan_name in jaz.plan, "Plan number " + plan_number + " is missing from the JAZ.");
    var plan = jaz.plan[plan_name].sequence;
    return plan;
}

function get_operations_list(jaz, plan) {
    var comp_model_name;
    for (var cm_name in jaz.cm) {
        comp_model_name = cm_name;
    }
    var ops = jaz.cm[comp_model_name].ops;

    var operations_info = {};

    for (var operation of plan) {
        var operation_info = ops[operation];
        var code_name = operation_info.code.replace("local://code/", "");
        var code_info = jaz.code[code_name];
        var operation_args = operation_info.args;
        var code_params = code_info.params;
        var inputs = [], outputs = [];
        for (var arg_num in operation_args) {
            var arg = operation_args[arg_num];
            if (code_params[arg_num].kind === "input" && !inputs.includes(arg))
                inputs.push(arg);
            else if (code_params[arg_num].kind === "output" && !outputs.includes(arg))
                outputs.push(arg);
        }
        operations_info[operation] = { "inputs": inputs, "outputs": outputs };
    }
    // console.log(operations_info);
    return operations_info;
}

function build_dependency_tree(operations_info) {
    const dependencies = {};
    for (const op in operations_info) {
        dependencies[op] = { parents: [], children: [] };
    }

    for (const op in operations_info) {
        const outputs = operations_info[op].outputs;

        outputs.forEach(output => {
            for (const otherOp in operations_info) {
                if (operations_info[otherOp].inputs.includes(output)) {
                    if (!dependencies[otherOp].parents.includes(op)) {
                        dependencies[otherOp].parents.push(op);
                    }
                    if (!dependencies[op].children.includes(otherOp)) {
                        dependencies[op].children.push(otherOp);
                    }
                }
            }
        });
    }
    return dependencies;
}

function plan_processing(jaz, plan_number) {
    var plan = get_plan(jaz, plan_number);
    var operations_info = get_operations_list(jaz, plan);

    var dependencies = build_dependency_tree(operations_info);

    var operations = [];
    var i = 0;
    for (var operation_name of plan) {
        var weight = 3;
        if ("weight" in operations_info[operation_name]) {
            weight = operations_info[operation_name].weight;
        }
        operations.push({
            id: i,
            name: operation_name,
            weight: weight,
            parents: dependencies[operation_name].parents.map(parent => plan.indexOf(parent)),
            children: dependencies[operation_name].children.map(child => plan.indexOf(child)),
            rank: -1
        });
        i++;
    }
    i = 0;

    let operations_for_log = JSON.parse(JSON.stringify(operations));;
    for (let op of operations_for_log) {
        op.parents.forEach((parent, i) => op.parents[i] = operations_for_log[parent].name);
        op.children.forEach((child, i) => op.children[i] = operations_for_log[child].name);
    }
    // console.log(operations_for_log);
    return operations;
}

module.exports = {
    plan_processing
}
