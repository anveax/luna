#!/usr/bin/env node

// CLIF-stdio jaz => schema.json

const assert = require('assert');
const fs = require('fs');

const build = require("./build.js");
const { traverse } = require("./common.js");

function get_single_locator(jaz, category) {
	var keys = Object.keys(jaz[category]);
	assert(keys.length === 1);
	return `local://${category}/${keys[0]}`;
}

var jaz = JSON.parse(fs.readFileSync(0, "utf-8"));

var plan_id = get_single_locator(jaz, 'plan');
var plan = traverse(jaz, plan_id);

var schema = build(jaz, plan);

console.log(JSON.stringify(schema, null, 2));
