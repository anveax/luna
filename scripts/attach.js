/*
TODO: fix specs: where are outs?
CLIF:
	in path jaz
	in string field
	in string name
	in path item
	in path new_jaz
	in string new_jaz_name
*/

const assert = require('assert');
const fs = require('fs');

const attach = require('../src/attach.js');


var stdin_lines = fs.readFileSync(0, "utf-8").split("\n");
assert(stdin_lines.length === 7);
assert(stdin_lines.pop() === '');
var [ jaz_path, field, name, item_path, new_jaz_path, new_jaz_name ] = stdin_lines;

var jaz = JSON.parse(fs.readFileSync(jaz_path, "utf-8"));
var item = JSON.parse(fs.readFileSync(item_path, "utf-8"));
var new_jaz = attach(jaz, field, name, item);

fs.writeFileSync(path.join(new_jaz_path, new_jaz_name),
	JSON.stringify(new_jaz, null, 2), 'utf-8');
