#!/usr/bin/env node

// CLIF
//	in path blob x
//	out path blob x2

const assert = require('assert');
const fs = require('fs');

var  paths = fs.readFileSync(0).toString().split('\n');
assert(paths.length >= 2);
var data = fs.readFileSync(paths[0]);
fs.writeFileSync(paths[1], Buffer.concat([data, data]));
