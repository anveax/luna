#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');

assert(process.argv.length === 3);

const sub = require(process.argv[2]);

var input = fs.readFileSync(0);

sub(input, result => {
	console.log(result);
	process.exit(0);
});
