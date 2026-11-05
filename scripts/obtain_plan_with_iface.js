#!/usr/bin/env node

// PLAN:
// in path jaz
// in string iface
// out path out_plan

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { abort, get_single_locator, nimpl, traverse } =
	require("../src/common.js");

const obtain_plan = require("../src/obtain_plan.js");

const lines = fs.readFileSync(0, 'utf-8')
        .split('\n')
        .filter(x => x.length > 0);

assert(lines.length == 2, "Expected 2 arguments");

var jaz = JSON.parse(fs.readFileSync(path.resolve(lines[0]), 'utf-8'));
var ifaceName = lines[1];

iface = traverse(jaz, `local://iface/${ifaceName}`);
assert(iface !== undefined);
iface["name"] = ifaceName;

var new_jaz = obtain_plan(jaz, iface);

// TODO: we need to know jaz base path to locate code frags

console.log(JSON.stringify(new_jaz, null, 2));
