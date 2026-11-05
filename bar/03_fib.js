// forall stdin[i] i=0..inf stdout[i] = fib[stdin[i]];

const assert = require('assert');
const fs = require('fs');

const { create_bar } = require("./bar.js");
const { nimpl } = require("../src/common.js");

function fib_simple(what) {
	if (what === 'fib:0' || what === 'fib:1')
		return cb => { cb(what, 'int32', 1); };
	else
		return null;
}

function fib_other(what) {
	if (!/^fib:[0-9]+$/.test(what))
		return null;

	var num = parseInt(what.substr(4));
	if (num < 2)
		return null;

	var deps = [];
	var result = 0;
	for (var n=num-2; n<num; n++) {
		var id = `fib:${n}`;

		if (!this.is_defined(id)) {
			deps.push(id);
		} else {
			assert(this.is_true(id));
			result += this.get_value(id);
		}
	}

	if (deps.length > 0)
		return deps;

	return cb => {
		cb(what, 'int32', result);
	}
}

function stdin_lines() {
	var lines;

	var oper = function(what) {
		var varid_re = /^stdin:[0-9]+$/;
		if (!varid_re.test(what))
			return null;

		var num = parseInt(what.substr(6));

		function obtain_lines(cb) {
			if (lines !== undefined)
				return cb(lines);

			fs.readFile(0, (err, data) => {
				if (err)
					abort("stdin read error", err);

				assert(lines === undefined);
				lines = data.toString().split('\n');
				assert(lines.pop() === '');

				cb();
			});
		}

		var res = function(cb) {
			obtain_lines(() => {
				assert(lines !== undefined);

				if (num >= lines.length)
					cb(what, null);
				else
					cb(what, 'string', lines[num]);
			});
		}

		res.cost = 10;
		return res;
	}

	oper.caption = "stdin_lines";
	return oper;
}

function outputs(what) {
	if (!/^stdout:[0-9]+$/.test(what))
		return null;

	var num = parseInt(what.substr(7));

	var stdin_line = `stdin:${num}`;

	if (!this.is_defined(stdin_line))
		return [stdin_line];

	if (this.is_false(stdin_line))
		return cb => { cb(what, null); };

	var fib_num = parseInt(this.get_string(stdin_line));

	var fib_id = `fib:${fib_num}`;

	if (!this.is_defined(fib_id))
		return [fib_id];

	var result = this.get_int(fib_id);

	return cb => { cb(what, 'int32', result); }
}

var bar = create_bar();
bar.push(fib_simple);
bar.push(fib_other);
bar.push(stdin_lines());
bar.push(outputs);

var n=0;
function on_stdout(val) {
	console.log(`stdout:${n} =`, val);
	if (val.type === null)
		return;
	n++;
	bar.demand(`stdout:${n}`, on_stdout);
}
bar.demand('stdout:0', on_stdout);
bar.demand('stdin:0', console.log);
