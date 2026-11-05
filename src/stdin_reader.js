const readline = require('readline');

const { abort } = require("./common.js");

var cb_queue = [];
var lines = [];
var rl;
var closed = false;

log = require("./log.js").log;

function init() {
	log("initializing");
	rl = readline.createInterface({
		input: process.stdin,
		terminal: false
	});

	rl.on('line', line => {
		if (cb_queue.length > 0) {
			var cb = cb_queue.shift();
			log("received line, handling:", line);
			process.nextTick(() => cb(line));
		} else {
			log("received line, enqueue:", line);
			lines.push(line);
		}
	});

	rl.on('close', () => {
		if (cb_queue.length > 0)
			abort("unexpected EOF", cb_queue.length);
		closed = true;
		log("closed");
	});

	log("initialized");
}

function on_next_line(cb) {
	if (rl === undefined)
		init();

	if (lines.length > 0) {
		var line = lines.shift();
		process.nextTick(() => cb(line));
	} else {
		if (closed)
			abort("stdin already closed");
		cb_queue.push(cb);
	}
}

module.exports = { on_next_line };
