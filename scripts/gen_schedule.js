#!/usr/bin/env node

const assert = require('assert');
const { readFileSync } = require('fs');
const { get_nodes_info } = require('../src/computer_info.js');
const { plan_processing } = require('../src/plan_processing.js');
const { heft } = require('../src/heft.js');
const attach = require('../src/attach.js');

var lines = readFileSync(0, 'utf-8').split('\n');
assert(lines.length >= 2);

var jaz_path = lines[0];
var nodes_count = parseInt(lines[1]);
if (Number.isNaN(nodes_count)) {
    nodes_count = 1;
}
var plan_number = parseInt(lines[2]);
if (Number.isNaN(plan_number)) {
    plan_number = 1;
}
var plan_name = "plan" + plan_number;
var schedule_name = "schedule" + plan_number;

var jaz = JSON.parse(readFileSync(jaz_path));
var operations = plan_processing(jaz, plan_number);

var processors = get_nodes_info(nodes_count);

var schedule = heft(operations, processors);
var schedule_result = { "plan": "local://plan/" + plan_name, "schedule": schedule };

var jaz_result = attach(jaz, 'schedule', schedule_name, schedule_result);
jaz_result = JSON.stringify(jaz_result, null, 2);

console.log(jaz_result);
