// TODO: show error when cannot deduce demands
const assert = require('assert');
const fs = require('fs');

const { abort, nimpl } = require("../src/common.js");
const { log } = require("../src/log.js");

function is_array(what) {
	return typeof what === "object" &&
		what.constructor.name === "Array";
}

function is_valid_type(type) {
	return ['int32', 'real64', 'string', 'blob'].indexOf(type) !== -1;
}

// returns computer routine: cb => cb(id, type, value)
function find_best_move() {
	// Algorithm:
	// Starting from all demands
	// Search for their terms
	// Once a full term is found, return its first move


	// Element structure: {
	//     parent: "<varid>",
	//     deps:  "<varid>"...]
	// }

	var qp = 0;
	var queue = [];
	var computable = this.get_true_vars();

	function propogate(varid) {
		// We are propogating from a leaf.
		// Eliminate deps up the parent chain.
		// If it leads us to the root -- return true
		for (var i=0; i<qp; i++) {
			var item = queue[i];
			if (item.deps.indexOf(varid) === -1)
				continue;

			item.deps = item.deps.filter(el => el != varid);
			if (item.deps.length === 0) {
				if (item.parent in this.demands)
					return true; // found a ready term
				else if (propogate.call(this, item.parent))
					return true;
				// Propogate further
			}
		}
		return false; // no ready term found
	}

	function handle_varid(varid) {
		log("trying", varid);
		for (var oper of this.opers) {
			var res = oper.call(this, varid);
			if (res === null) {
				continue; // can't help
			} else if (is_array(res)) {
				var deps = res.filter(id =>
					computable.indexOf(id) === -1);
				if (deps.length === 0)
					nimpl(""); // This is a special case:
					// all dependencies were computed by some
					// previous operation, we don't know which
					// we should find a leaf on the term
					// and don't forget to propogate varid
					// as computed

				// unresolved dependencies
				queue.push({
					parent: varid,
					deps: res
				});
				log(queue);
			} else if (typeof res === "function") {
				if (varid in this.demands)
					return res;
				// can compute -- propogate varid
				if (propogate.call(this, varid)) {
					return res;
				}
			} else {
				abort("what is this?", res);
			}
		}
		return null; // no ready term found
	}

	for (var varid in this.demands) {
		var res = handle_varid.call(this, varid);
		if (res !== null) {
			assert(typeof res === "function");
			return res;
		}
	}

	while (qp < queue.length) {
		var item = queue[qp++];

		for (var varid of item.deps) {
			var res = handle_varid.call(this, varid);
			if (res !== null) {
				assert(typeof res === "function");
				return res;
			}
		}
	}

	return null;
}

function dump(what, type, value) {
	var filename = `_dump_${what}_${type}`;

	switch (type) {
		case 'int32': {
			var buffer = Buffer.alloc(4);
			buffer.writeInt32LE(value, 0);
			fs.writeFileSync(filename, buffer);
			break;
		}
		case 'real64': {
			var buffer = Buffer.alloc(8);
			buffer.writeDoubleLE(value, 0);
			fs.writeFileSync(filename, buffer);
			break;
		}
		case 'string': {
			fs.writeFileSync(filename, value);
			break;
		}
		case 'blob': {
			fs.writeFileSync(filename, value);
			break;
		}
		default:
			nimpl(...arguments);
	}
}

function Bar() {
	this.opers = [];
	this.running = false;
	this.demands = {};
	this.vars = {};
	this.idle_listeners = [];

	this.demand = function(varid, cb) {
		log("demand", varid);
		if (varid in this.vars) {
			return process.nextTick(() => {
				cb(this.vars[varid]);
			});
		}

		if (!(varid in this.demands)) {
			this.demands[varid] = [];
		}

		this.demands[varid].push(cb);

		this._ensure_running();
	}

	this.get_typed_value = function(varid, type) {
		assert(is_valid_type(type));
		assert(this.is_true(varid));
		assert(this.vars[varid].type === type);
		return this.get_value(varid);
	}

	this.get_int = function(varid) {
		return this.get_typed_value(varid, 'int32');
	}

	this.get_real = function(varid) {
		return this.get_typed_value(varid, 'real64');
	}

	this.get_string = function(varid) {
		return this.get_typed_value(varid, 'string');
	}

	this.get_type = function(varid) {
		assert(this.is_true(varid));
		return this.vars[varid].type;
	}

	this.get_value = function(varid) {
		assert(this.is_true(varid));
		return this.vars[varid].value;
	}

	this.get_true_vars = function() {
		return Object.keys(this.vars).filter(varid =>
			this.is_true(varid));
	}

	this.is_defined = function(varid) {
		return varid in this.vars;
	}

	this.is_false = function(varid) {
		if (this.is_defined(varid))
			return this.vars[varid].type === null;
	}

	this.is_true = function(varid) {
		if (this.is_defined(varid))
			return this.vars[varid].type !== null;
	}

	this.on_idle = function(cb) {
		this.idle_listeners.push(cb);
		this._ensure_running();
	}

	this.push = function(opers) {
		if (typeof opers === 'function')
			opers = [opers];

		log("push opers", opers);

		opers.forEach(oper => this.opers.push(oper));

		this._ensure_running();
	}

	this._ensure_running = function() {
		process.nextTick(() => {
			this._ensure_running_body();
		});
	}

	this._ensure_running_body = function() {
		log("_ensure_running_body", this.running);
		if (this.running)
			return;

		this.running = true;

		// check if we can do something to satisfy demands
		var move = find_best_move.call(this);

		if (move === null) {
			this.running = false;
			log("RUNNING", false);

			if (this.idle_listeners.length !== 0) {
				this.idle_listeners.shift()();
				process.nextTick(() => {
					this._ensure_running();
				});
			}
		} else {
			move.call(this, (what, type, value) => {
				if (what === null) {
					// failed op
					this.running = false;
					this._ensure_running();
					log("failed op =============================");
					return;
				}
				assert(typeof what === "string");
				assert(type === null || is_valid_type(type));
				assert(type === null || value !== undefined);
				if (what in this.vars) {
					nimpl("check dup", this.vars, what);
				} else {
					log("SET", what, type, value);
					//TODO make run option: dump
					//dump(what, type, value);
					this.vars[what] = { type, value };
					while (what in this.demands) {
						assert(this.demands[what].length > 0);
						var cb = this.demands[what].shift();
						if (this.demands[what].length === 0)
							delete this.demands[what];
						cb({ value, type });
					}
				}
				// TODO: correctly handle multiple outputs
				this.running = false;
				log("RUNNING", false);
				process.nextTick(() => {
					this._ensure_running();
				});
			});
		}
	}
}

function create_bar() {
	return new Bar();
}

module.exports = { create_bar };
