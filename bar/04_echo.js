// echo test

const { create_bar } = require("./bar.js");
const { abort, nimpl } = require("../src/common.js");
const { create_stdio_opers, stdio_write_stdout } =
	require("./stdio_opers.js");

function echo_oper(what) {
	if (!/^stdout:[0-9]+$/.test(what))
		return null;

	var id = 'stdin:' + what.substr(7);

	if (!this.is_defined(id))
		return [id];

	if (this.is_false(id))
		return cb => cb(what, null);

	return cb => cb(what, 'string', this.get_string(id));
}

var bar = create_bar();
bar.push(create_stdio_opers());
stdio_write_stdout((what, cb) => bar.demand(what, cb));
bar.push(echo_oper);

