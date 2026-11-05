#!/usr/bin/env node

/*
	CLIF specs:
		in path JAZ
		in string key
		in string value
		out path OUT_JAZ
*/

const fs = require('fs');

var lines = fs.readFileSync(0).toString().split('\n');
var jaz = JSON.parse(fs.readFileSync(lines[0]));
var key = lines[1];
var value = lines[2];
var out_path = lines[3];

jaz[key]=value;
fs.writeFileSync(out_path, JSON.stringify(jaz, null, 2));
