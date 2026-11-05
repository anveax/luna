const assert = require('assert');
const fs = require('fs');

const { create_bar } = require("./bar.js");
const { abort, nimpl } = require("../src/common.js");

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

var bar = create_bar();

bar.push(stdin_lines());
bar.demand("stdin:0", val => {
	console.log("stdin:0 is", val.type, val.value);
});
bar.demand("stdin:10", val => {
	console.log("stdin:10 is", val.type, val.value);
});
bar.on_idle(() => {
//	console.log("stop");
});
