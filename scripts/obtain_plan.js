#!/usr/bin/env node

// PLAN:
// in path jaz
// out path out_plan

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const obtain_plan = require("../src/obtain_plan.js");


var jaz = JSON.parse(fs.readFileSync(0, 'utf-8'));
var new_jaz = obtain_plan(jaz);

// TODO: we need to know jaz base path to locate code frags

console.log(JSON.stringify(new_jaz, null, 2));
