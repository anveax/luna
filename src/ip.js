const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { jclone, nimpl } = require("./common.js");
const execute = require("./execute.js");
const { log, log_enable } = require("./log.js");
const mdijkstra = require("./mdijkstra.js");

log_enable(false);

function get_path(locator, base_path) {
	assert(arguments.length === 2);
	if (!locator.startsWith('fs://'))
		nimpl(locator);

	var p = locator.substr(5);
	if (!p.startsWith('/'))
		p = path.join(base_path, p);
	return p;
}

function fetch_code_manifest(base_path, code_path) {
	var code_path = path.join(base_path, code_path);
	// TODO use relative part to jaz file, not cwd
	var stats = fs.statSync(code_path);
	if (stats.isDirectory())
		code_path = path.join(code_path, 'manifest.json');
	stats = fs.statSync(code_path);
	assert(stats.isFile());

	return JSON.parse(fs.readFileSync(code_path));
}

class Interpreter {
	constructor(jaz_path, jaz, cmid) {
		this.jaz_path = jaz_path;
		this.base_path = path.dirname(path.resolve(jaz_path));
		this.jaz = jaz;
		if ('.base_dir' in this.jaz)
			this.base_path = this.jaz['.base_dir'];
		this.sys_dir = path.join(path.dirname(__filename), '..');
		this.cmid = cmid;
		this.vars = {};
		this.demands = {};
		this._is_running = false;
		this.mf = {};
		log("instance created");
		this._executed = {};
	}

	_check_demands() {
		var matched_vars=[];
		for (var what in this.demands) {
			if (what in this.vars)
				matched_vars.push(what);
		}

		var cbs = [];
		for (var what of matched_vars) {
			for (var cb of this.demands[what])
				cbs.push(() => {
					log("returning", what);
					cb(this.vars[what]);
				});
			delete this.demands[what];
		}
		cbs.forEach(cb => {
			process.nextTick(() => {
				cb();
			});
		});
	}

	demand(what, cb) {
		if (what in this.vars) {
			log("demanded what we have, returning", what);
			return cb(this.vars[what]);
		}

		if (!(what in this.demands))
			this.demands[what] = [];

		log("demand registered", what);
		this.demands[what].push(cb);

		this._ensure_running();
	}

	_ensure_running() {
		if (this._is_running)
			return; // already running
		this._is_running = true;

		log("running");

		// if we have some unsatisfied demands, then do
		// planning and execute one oper
		var W = this._get_unsatisfied_demands();
		if (W.length === 0) {
			log("no demands, going idle");
			this._is_running = false;
			return;
		}

		var V = Object.keys(this.vars);
		var plan = this._obtain_plan(V, W);
		if (plan === null) {
			log("cannot get plan, going idle");
			this._is_running = false;
			return;
		}

		var op = plan[0];
		log("PLAN", plan);
		this._execute(op);

	}

	_execute(opid) {
		assert(this._is_running);
		assert(!(opid in this._executed));
		this._executed[opid] = 'started';
		log("EXECUTE", opid);
		// get all inputs, invoke code and sumbit outputs
		var cm = this._get_cm(this.cmid);
		var op = cm.ops[opid];
		var mf = this._get_code(op.code);

		var self=this;

		// TODO: replace iconst with int
		function value_provider(what) {
			if (what.startsWith('local://val/')) {
				var id = what.substr(12);
				assert(id in self.jaz.val);
				return self.jaz.val[id].value;
				nimpl(id, self.jaz.val[id]);
			}
			if (!(what in self.vars))
				nimpl(what);
			assert(what in self.vars);
			return self.vars[what].value;
		}

		var code_path;
		if (op.code.startsWith('fs://')) {
			code_path = get_path(op.code, this.base_path);
		} else if (op.code.startsWith('local://code/')) {
			if (!('.dir' in mf))
				nimpl();
			code_path = mf['.dir'];
		}
		log("executing", opid, code_path);
		execute(this.sys_dir, code_path, op.args, value_provider, (what, value) => {
			log("got out from exec", what, value);
			this.submit(what, value);
		}, () => {
			assert(this._executed[opid] === 'started');
			this._executed[opid] = 'finished';
			assert(this._is_running);
			this._is_running = false;
			process.nextTick(() => {
				this._ensure_running();
			});
		});
	}

	_get_code(cid) {
		if (cid.startsWith('fs://')) {
			if (cid in this.mf)
				return this.mf[cid];

			var code_path = cid.substr(5);
			var manifest = fetch_code_manifest(this.base_path, code_path);
			this.mf[cid] = manifest;

			return manifest;
		} else if (cid.startsWith('local://code/')) {
			var code_id = cid.substr(13);
			assert(code_id in this.jaz.code);
			return this.jaz.code[code_id];
		} else
			nimpl(cid);
	}

	_get_cm(cmid) {
		if (!cmid.startsWith('local://cm/'))
			nimpl(cmid);

		var name = cmid.substr(11);
		assert(name in this.jaz.cm);
		return this.jaz.cm[name];
	}

	_get_operands(opid, kind) {
		var cm = this._get_cm(this.cmid);

		var op = cm.ops[opid];
		var code = this._get_code(op.code);

		assert(code.params.length === op.args.length);

		var res = [];
		for (var i=0; i<op.args.length; i++) {
			if (code.params[i].kind !== kind)
				continue;

			var arg = op.args[i];
			if (kind === 'input' && arg.startsWith('local://val/')) {
				assert(arg.substr(12) in this.jaz.val);
				continue;
			}

			res.push(op.args[i]);
		}
		return res;
	}

	_get_unsatisfied_demands() {
		var res = [];
		for (var what in this.demands)
			if (!(what in this.vars))
				res.push(what);
		return res;
	}

	_obtain_plan(V, W) {
		var self=this;
		var cm = this._get_cm(this.cmid);

		function get_consumers(varid) {
			if (varid === undefined) {
				var res = [];
				// return all operations with no inputs
				for (var opid in cm.ops) {
					var op = cm.ops[opid];
					var code = self._get_code(op.code);
					var inputs_count = code.params.filter(
						par => par.kind === 'input').length;
					if (inputs_count === 0) {
						res.push(opid);
					}
				}
				log("inputless", res);
				return res;
			}

			var res = {};
			// find all consumers of varid
			for (var opid in cm.ops) {
				var ins = self._get_operands(opid, 'input');
				var has_in = ins.indexOf(varid) !== -1;
				if (has_in)
					res[opid] = {
						ins: self._get_operands(opid, 'input'),
						outs: self._get_operands(opid, 'output')
					};
			}
			//log(varid, "consumedby", res);
			return res;

		}
		var plan = mdijkstra(V, W, get_consumers);

		return plan.sequence;
	}

	ensure_equal_values(new_value, cur_value, what) {
		log("WARNING: duplicate values", what);
		if (new_value.type === cur_value.type
				&& new_value.value === cur_value.value)
			return;
		if (new_value.type !== cur_value.type)
			abort(...arguments);
		if (new_value.type === 'blob' &&
				new_value.value.equals(cur_value.value))
			return;
		nimpl(...arguments);
	}

	// SUBMIT
	submit(what, value) {
		if (what in this.vars) {
			this.ensure_equal_values(value, this.vars[what], what);
		} else {
			this.vars[what] = value;
			log("SET", what, value);
		}
		
		this._check_demands();
		this._ensure_running();
	}
}

module.exports = Interpreter;
