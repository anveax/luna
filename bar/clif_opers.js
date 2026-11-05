/*
	returns rules, which processes stdin and stdout according to
	the given clif specs.
*/

const assert = require('assert');
const fs = require('fs');

const { abort, nimpl } = require("../src/common.js");
const { log } = require("../src/log.js");

function write_to_stdout(what) {
	switch (what.type) {
		case 'int32': {
			var buffer = Buffer.alloc(4);
			buffer.writeInt32LE(what.value, 0);
			process.stdout.write(buffer);
			break;
		}
        case 'string': {
			process.stdout.write(what.value);
			break;
		}
		case 'blob':
			process.stdout.write(what.value);
			break;
		default:
			nimpl(what);
	}
}

function create_clif_opers(iface) {
	assert(iface.format === 'clif');

	var res = [];
	var stdin_idx=0;
	var stdout_idx = 0;

	function create_input_string_oper(param, stdin_idx) {
		assert(param.format === 'string');

		var id = `stdin:${stdin_idx}`;

		return function(what) {
			if (what !== param.target)
				return null;

			if (!this.is_defined(id))
				return [id];

			if (!this.is_true(id)) {
				abort("input parameter expected at " + id +
					": " + JSON.stringify(param));
			}

			if (this.get_type(id) !== 'string') {
				abort("not a string", id, this.get_type(id));
			}

			var value = this.get_value(id);

			switch (param.type) {
				case 'int32':
					return cb => {
						cb(what, param.type, parseInt(value));
					}
				case 'real64':
					return cb => {
						cb(what, param.type, parseFloat(value));
					}
				case 'string':
					return cb =>
						cb(what, param.type, value);
				default:
					nimpl(param, value);
			}
		}
	}

	function create_input_stdin_oper(param) {
		return function(what) {
			if (what !== param.target)
				return null;

			if (!this.is_defined('stdin'))
				return ['stdin'];

			if (!this.is_true('stdin')) {
				nimpl("what does it mean?");
			}

			if (this.get_type('stdin') !== 'blob')
				abort("illegal stdin type", this.get_type('stdin'));

			var value = this.get_value('stdin'); // Buffer

			switch (param.type) {
				case 'int32':
					return cb =>
						cb(what, param.type, parseInt(value));
				case 'real64':
					return cb =>
						cb(what, param.type, parseFloat(value));
				case 'string':
					return cb =>
						cb(what, param.type, value.toString());
				case 'blob':
					return cb =>
						cb(what, param.type, value);
				default:
					nimpl(param, value);
			}
		}
	}

	function create_input_path_oper(param, stdin_idx) {
		assert(param.format === 'path');

		var id = `stdin:${stdin_idx}`;

		return function(what) {
			if (what !== param.target)
				return null;

			if (!this.is_defined(id))
				return [id];

			if (!this.is_true(id)) {
				abort("input path expected at " + id +
					": " + JSON.stringify(param));
			}

			var filename = this.get_typed_value(id, 'string');

			switch(param.type) {
				case 'int32':
				case 'real64':
				case 'string':
					nimpl();
				case 'blob':
					var data = fs.readFileSync(filename);
					return cb => cb(what, param.type, data);
				default:
					nimpl(param, value);
			}
		}
	}

	function create_input_oper(param) {
		switch (param.format) {
			case 'path':
				return create_input_path_oper(param, stdin_idx++);
			case 'string':
				return create_input_string_oper(param, stdin_idx++);
			case 'stdin':
				return create_input_stdin_oper(param);
			default:
				nimpl(param);
		}
	}

	function create_output_string_oper(param, stdout_idx) {
		assert(param.format === 'string');

		var id = `stdout:${stdout_idx}`;

		return function(what) {
			if (what !== id)
				return null;

			if (!this.is_defined(param.source)) {
				return [param.source];
			}

			assert(this.is_true(param.source));
			
			var val_str = `${this.get_value(param.source)}`;

			return cb => cb(`stdout:${stdout_idx}`, 'string', val_str);
		};
	}

	function create_output_stdout_oper(param) {
		assert(param.format === 'stdout');

		return function(what) {
			if (what !== 'stdout')
				return null;

			if (!this.is_defined(param.source)) {
				return [param.source];
			}

			assert(this.is_true(param.source));

			var val_buf;
			switch (this.get_type(param.source)) {
				case 'int32':
					val_buf = this.get_typed_value(param.source, 'int32');
					break;
				case 'string':
					val_buf = Buffer.from(this.get_value(param.source));
					break;
				case 'blob':
					val_buf = this.get_value(param.source);
					break;
				default:
					nimpl(this.get_type(param.source), param.source);
			}

			return cb => cb('stdout', this.get_type(param.source), val_buf);
		}
	}

	function create_output_opers(param) {
		switch(param.format) {
			case 'string':
				return [create_output_string_oper(param, stdout_idx++)];
			case 'path':
				return []
			case 'stdout':
				return [create_output_stdout_oper(param)];
			default:
				nimpl(param);
		}
	}

	for (var param of iface.params) {
		switch(param.kind) {
			case 'input':
				res.push(create_input_oper(param));
				break;
			case 'output':
				create_output_opers(param).forEach(oper =>
					res.push(oper));
				break;
			default:
				abort(param);
		}
	}

	return res;
}

function create_clif_demands(iface, demand) {
	var iidx = 0;
	var oidx = 0;
	for (var param of iface.params) {
		switch(param.kind) {
			case 'input':
				switch (param.format) {
					case 'string':
						iidx++;
						break;
					case 'path':
						iidx++;
						break;
					case 'stdin':
						if (iidx !== 0)
							abort("not the only one for stdin");
						iidx = null; // no more indices
						break;
					default:
						nimpl(param, iidx);
				}
				break;
			case 'output':
				switch (param.format) {
					case 'string':
						demand(`stdout:${oidx++}`, res => {
							console.log(res.value)
						});
						break;
					case 'path':
						var id = `stdin:${iidx++}`;
						(id => {
							demand(param.source, res => {
								demand(id, out_path => {
									write_path(out_path, param, res);
								});
							});
						})(id);
						break;
					case 'stdout':
						demand('stdout', res => {
							write_to_stdout(res);
						});
						break;
					default:
						nimpl(param);
				}
				break;
			default:
				abort(param);
		}
	}
}

function write_path(out_path, param, res) {
	assert(out_path.type === 'string');
	assert(res.type !== null);

	switch (param.type) {
		case 'int32': {
			var buffer = Buffer.alloc(4);
			buffer.writeInt32LE(res.value, 0);
			fs.writeFileSync(out_path.value, buffer);
			break;
		}
		case 'real64': {
			var buffer = Buffer.alloc(8);
			buffer.writeDoubleLE(res.value, 0);
			fs.writeFileSync(out_path.value, buffer);
			break;
		}
		case 'blob': {
			fs.writeFileSync(out_path.value, res.value);
			break;
		}
		default:
			nimpl(...arguments);
	}
}

module.exports = { create_clif_opers, create_clif_demands };
