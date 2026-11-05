const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { abort, jclone, nimpl } = require("./common.js");
const generate_cpf_clif_wrapper =
	require("./generate_cpf_clif_wrapper.js");
function parse_local_locator(locator) {
	m=locator.match(/^local:\/\/([_a-zA-Z0-9]+)\/([_a-zA-Z0-9]+)$/);
	if (m === null)
		abort('illegal local locator', locator);

	return {
		category: m[1],
		key: m[2]
	};
}

class CodeError {
	constructor(locator, ...details) {
		this.locator = locator;
		this.details = details;
	}
}

function code_error(locator, ...details) {
	return new CodeError(...arguments);
}

class Env {
	#c_symbols; #fs_cache; #jaz; #next_id;

	constructor(jaz) {
		this.#c_symbols = {};
		this.#fs_cache = {};

		if (jaz !== undefined)
			this.#jaz = jaz;
		else
			this.#jaz = {};

		this.#next_id = 0;
	}

	add_code(code) {
		if (!('code' in this.#jaz))
			this.#jaz.code = {};
		if (code.c_func_name in this.#jaz.code)
			nimpl(code);

		this.#jaz.code[code.c_func_name] = code;
	}

	create_symbol() {
		while (true) {
			var symbol = `_id${this.#next_id++}`;
			if (symbol in this.#c_symbols)
				continue;

			return symbol;
		}
	}

	get_first_iface() {
		if (!('iface' in this.#jaz))
			abort("no ifaces");

		var iface_ids = Object.keys(this.#jaz.iface);

		if (iface_ids.length === 0)
			abort("no ifaces");

		return this.#jaz.iface[iface_ids[0]];
	}

	get_iface(plan){
	    if (!('plan' in this.#jaz))
			nimpl("jaz has no plan");

        if (!('iface' in this.#jaz))
			abort("no ifaces");

        var ifaceName = this.#jaz.plan[plan].iface.match(/iface\/(.+)/)[1];
		return this.#jaz.iface[ifaceName];
	}

	get_first_schedule() {
		if (!('schedule' in this.#jaz))
			abort("no schedules", this.#jaz);

		var sched_ids = Object.keys(this.#jaz.schedule);

		if (sched_ids.length === 0)
			abort("no scheds");

		return this.#jaz.schedule[sched_ids[0]];
	}

	get_c_value(locator) {
		var { category, key } = parse_local_locator(locator);
		if (category === 'val' && key in this.#jaz.val) {
			var val = this.#jaz.val[key];

			switch (val.type) {
				case 'int32':
					return `${val.value}`;
				case 'string':
					return `${JSON.stringify(val.value)}`;
				default:
					nimpl(val);
			}
		}

		abort("no value found", locator);
	}


	get_code(locator) {
		var m = locator.match(/^([a-z]+):\/\/(.*)$/)

		if (m === null)
			abort("illegal locator", locator);
		var proto = m[1];
		var rest = m[2];
		switch (proto) {
			case 'local': {
				var { category, key } = parse_local_locator(locator);
				if (category !== 'code')
					abort('category is not "code"', locator);
				if (!('code' in this.#jaz) || !(key in this.#jaz.code))
					abort('not found', locator);
				return this.#jaz.code[key];
			}
			case 'fs': {
				if (locator in this.#fs_cache)
					return this.#fs_cache[locator];
				var res;
				if (!rest.startsWith('/')) {
					rest = path.join(this.#jaz['.base_dir'], rest);
				}
				try {
					if (fs.lstatSync(rest).isFile())
						res = JSON.parse(fs.readFileSync(rest));
					else if (fs.lstatSync(rest).isDirectory()) {
						res = JSON.parse(fs.readFileSync(path.join(rest,
							'manifest.json')));
					} else
						abort(locator);
					this.#fs_cache[locator] = res;
					return res;
				} catch (err) {
					throw code_error(locator, err);
				}
			}
			default:
				nimpl(proto, m);
		}
		nimpl(cm_locator);
	}

	get_code_by_symbol(symbol) {
		assert(symbol in this.#c_symbols);
		return this.get_code(this.#c_symbols[symbol]);
	}

	get_cm(cm_locator) {
		var m = cm_locator.match(/^([a-z]+):\/\/(.*)$/)

		if (m === null)
			abort("illegal locator", cm_locator);
		var proto = m[1];
		switch (proto) {
			case 'local': {
				var { category, key } = parse_local_locator(cm_locator);
				if (category !== 'cm')
					abort('category is not "cm"', cm_locator);
				if (!('cm' in this.#jaz) || !(key in this.#jaz.cm))
					abort('not found', cm_locator);
				return this.#jaz.cm[key];
			}
			default:
				nimpl(proto, m);
		}
		nimpl(cm_locator);
	}

	get_jaz() { return jclone(this.#jaz); }

	get_sequence(plan) {
		if (!('plan' in this.#jaz))
			nimpl("jaz has no plan");

		return this.#jaz.plan[plan].sequence;
	}

	get_cpf_wrapper_for_clif(cloc) {
		var clif = this.get_code(cloc);
		assert(clif.format === 'clif');
		// okay, we have a clif. no we gotta create a new CPF
		var cpf = new CpfClifWrapper(this, clif);
		nimpl(code);
		return code;
	}

	get_symbol_for_code(cloc) {
		var code = this.get_code(cloc);
		switch (code.format) {
			case 'clif': {
				var symbol = this.create_symbol();
				var listing = generate_cpf_clif_wrapper(code, symbol, cloc);
				this.add_code({
					type: 'codefrag',
					format: 'cpf',
					listing,
					c_func_name: symbol,
					params: code.params
				});
				this.#c_symbols[symbol] = `local://code/${symbol}`;
				return symbol;
			}
			case 'cpf':
				if (!(code.c_func_name in this.#c_symbols)) {
					this.#c_symbols[code.c_func_name] = cloc;
				} else {
					assert(this.#c_symbols[code.c_func_name] === cloc);
				}
				assert(code.c_func_name !== undefined);
				return code.c_func_name;
			default:
				nimpl(code)
		}
	}

	has_value(locator) {
		var { category, key } = parse_local_locator(locator);
		if (category === 'val' && key in this.#jaz.val)
			return true;
		return false;
	}

	// returns { "<cmid>": ["<opid>"]... } purged
	purge_codefrag(locator) {
		// Algorithm:
		// remove all operations, which refer to given codefrag locator
		if (!('cm' in this.#jaz))
			return {}; // no cms

		var purged = {};

		for (var cmid in this.#jaz.cm) {
			var cm = this.#jaz.cm[cmid];

			for (var opid in cm.ops) {
				if (cm.ops[opid].code === locator) {
					delete cm.ops[opid];
					if (!(cmid in purged))
						purged[cmid] = [];
					purged[cmid].push(opid);
				}
			}
		}

		return purged;
	}

	register_c_func_name(codefrag) {
		while (true) {
			var id = `_cpf_auto_${this.#next_id++}`;
			if (!(id in this.#c_symbols)) {
				this.#c_symbols[id] = codefrag;
				return id;
			}
		}
	}

	to_jaz() {
		return JSON.parse(JSON.stringify(this.#jaz));
	}
}

Env.CodeError = CodeError;

Env.prototype.is_locator = function(s) {
	var m = s.match(/^([a-z]+):\/\/(.*)$/)
	return m !== null;
}

module.exports = Env;
