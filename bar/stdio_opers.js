const assert = require('assert');

const { nimpl } = require("../src/common.js");

const { Transform } = require('stream');

const lineSplitter = new Transform({
	readableObjectMode: true,
	transform(chunk, encoding, callback) {
		if (!this._buffer) this._buffer = Buffer.alloc(0);

		whole_stdin = Buffer.concat([whole_stdin, chunk]);
		this._buffer = Buffer.concat([this._buffer, chunk]);

		let start = 0;
		let index;

		while ((index = this._buffer.indexOf(10, start)) !== -1) {
			const line = this._buffer.slice(start, index);
			this.push(line.toString());
			start = index + 1;
		}

		this._buffer = this._buffer.slice(start);
		callback();
	},
	flush(callback) {
	if (this._buffer && this._buffer.length > 0) {
		this.push(this._buffer.toString());
	}
	callback();
	}
});

var started = false;
var stdin_idx = 0;
var closed = false;
var lines = [];
var whole_stdin = Buffer.alloc(0);
var listeners = {};
var stdin_listener = undefined;

function line_handler(line) {
	assert(lines.length === stdin_idx);
	if (process.stdin.readableEnded) {
		nimpl(lines, line);
	}
	lines.push(line);
	stdin_idx++;
	check_listeners();
}

function check_listeners() {
	for (var i=0; i<stdin_idx; i++) {
		if (listeners[i]) {
			var cb = listeners[i];
			var line = lines[i];
			((cb, line) => {
				process.nextTick(() => {
					cb(line);
				});
			})(cb, line);
			delete listeners[i];
		}
	}

	if (!closed)
		return;

	for (var i in listeners) {
		if(parseInt(i) >= stdin_idx) {
			listeners[i](null);
		}
	}

	if (stdin_listener !== undefined)
		stdin_listener();
}

function create_string_provider(what) {
	assert(what.startsWith('stdin:'));
	var num = parseInt(what.substr(6));

	function provider(submit_value) {
		if (num in lines)
			submit_value(what, 'string', lines[num]);
		else if (closed && num >= stdin_idx) {
			submit_value(what, null); // beyond EOS
		} else {
			assert(!(num in listeners)); // we shouldn't have dups
			listeners[num] = line => {
				if (line === null)
					submit_value(what, null);
				else
					submit_value(what, 'string', line);
			};
		}
	};
	return provider;
}

function create_stdin_provider() {
	return cb => {
		if (closed)
			cb('stdin', 'blob', whole_stdin);
		else {
			assert(stdin_listener === undefined);
			stdin_listener = () => {
				cb('stdin', 'blob', whole_stdin);
			};
		}
	};
}

function stdin_oper(what) {
	if (what === 'stdin')
		return create_stdin_provider();

	if (/^stdin:[0-9]+$/.test(what))
		return create_string_provider(what);

	return null;
}

function create_stdio_opers() {
	assert(!started);
	started = true;

	process.stdin.pipe(lineSplitter);

	lineSplitter.on('data', line_handler);

	lineSplitter.on('end', () => {
		closed = true;
		check_listeners();
	});

	return stdin_oper;
}

function stdio_write_stdout(demand) {
	var stdout_num = 0;
	function handle_stdout_var(val) {
		if (val.type === null)
			return;
		assert(val.type === 'string');
		console.log(val.value);
		stdout_num++;
		process.nextTick(() => {
			demand(`stdout:${stdout_num}`, handle_stdout_var);
		});
	}
	demand('stdout:0', handle_stdout_var);
}

module.exports = { create_stdio_opers, stdio_write_stdout }
