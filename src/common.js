const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function abort(what) {
	if (arguments.length === 0) {
		var err = Error("ABORT");
		Error.captureStackTrace(err, abort);
		throw err;
	} else {
		console.error("[ABORT]", ...arguments);
		var err = Error("ABORT");
		Error.captureStackTrace(err, abort);
		throw err;
	}
}

function attach(jaz, type, what) {
	if (!(type in jaz)) {
		jaz[type] = {};
	}

	let num=0;

	while (true) {
		let key = `__auto_${num++}`;
		if (key in jaz[type])
			continue;

		jaz[type][key] = what;
		return `local://${type}/${key}`;
	}
}

var _next_el_id = 0;
function create_el(dict, value) {
	while (true) {
		let id = `id${_next_el_id++}`;
		if (id in dict)
			continue;

		dict[id] = value;
		return id;
	}
}

function create_tmp() {
	var tmpDir = os.tmpdir();
	var tempDirPath = fs.mkdtempSync(path.join(tmpDir, 'temp'));
	var tempFilePath = path.join(tempDirPath, 'tempfile');
	return tempFilePath;
}

function delete_tmp(file_path) {
	const dirPath = path.dirname(file_path);
	fs.rmSync(dirPath, { recursive: true, force: true });
}

function drop_hash(data) {
	if (typeof data === "object" && data.constructor.name === "Buffer")
		data = data.toString();
	
	assert(typeof data === "string", typeof(data));

	if (data.startsWith("#!")) {
		if (data.indexOf('\n') === -1)
			return '';
		else
			return data.substr(data.indexOf('\n'));
	} else
		return data;
}

function get_single_locator(jaz, category) {
	var keys = Object.keys(jaz[category]);
	return `local://${category}/${keys[0]}`;
}

function jclone(what) {
	assert(what !== undefined);
	return JSON.parse(JSON.stringify(what));
}

function nimpl(what) {
	if (arguments.length === 0) {
		var err = Error("NIMPL");
		Error.captureStackTrace(err, nimpl);
		throw err;
	} else {
		console.error("[NIMPL]", ...arguments);
		var err = Error("NIMPL");
		Error.captureStackTrace(err, nimpl);
		throw err;
	}
}

// returns { keys, flags, args }
function parse_args(argv) {
	argv = jclone(argv);
	let keys = {};
	let flags = [];
	let args = [];

	function add_key(key, val) {
		if (key in keys)
			throw Error("duplicate key: " + key);
		keys[key] = val;
	}

	function add_flag(flag) {
		if (flags.indexOf(flag) !== -1)
			throw Error("duplicate flag: " + flag);
		flags.push(flag);
	}

	while (argv.length > 0) {
		let arg = argv.shift();
		var m = arg.match(/^--([^=]+)=(.*)$/);
		if (m !== null) {
			let [key, val] = m.slice(1);
			add_key(key, val);
			continue;
		}
		m = arg.match(/^--(.+)$/);
		if (m !== null) {
			let flag = m[1];
			add_flag(flag);
			continue;
		}
		m = arg.match(/^-(.)$/);
		if (m !== null) {
			let flag = m[1];
			add_flag(flag);
			continue;
		}

		args.push(arg);
	}

	return { keys, flags, args };
}

function forbid_new(foo) {
	return function() {
		if (new.target === undefined) {
			return new foo(...arguments);
		} else {
			throw Error("call without 'new'");
		}
	}
}

function to_ref(expr) {
	if (typeof expr !== "string")
		nimpl("must be a string", expr, typeof expr);
	return expr;
}

var _gbl_cache = {};
function get_by_locator(jaz, locator) {
	m=locator.match(/^([a-z]+):\/\/(.*)$/);
	var proto = m[1];
	var rest = m[2];

	switch (proto) {
		case 'local':
			return traverse(jaz, locator);
		case 'fs': {
			if (locator in _gbl_cache)
				return _gbl_cache[locator];
			var res;
			if (fs.lstatSync(rest).isFile())
				res = JSON.parse(fs.readFileSync(rest));
			else if (fs.lstatSync(rest).isDirectory())
				res = JSON.parse(fs.readFileSync(path.join(rest,
					'manifest.json')));
			else
				abort(locator);
			_gbl_cache[locator] = res;
			return res;
		}
		default:
			nimpl(proto, locator);
	}
}

function traverse(jaz, locator) {
	m=locator.match(/^local:\/\/([_a-zA-Z0-9]+)\/([_a-zA-Z0-9]+)$/)
	if (m===null)
		throw Error("not a valid locator: " + locator);
	assert(m[1] in jaz && m[2] in jaz[m[1]],
		`Failed to resolve locator: ${locator}`);
	return jaz[m[1]][m[2]];
}

function unique(list) {
	var result = [];

	list.forEach(item => {
		if (result.indexOf(item) === -1)
			result.push(item);
	});

	return result;
}

module.exports = {
	abort,
	attach,
	create_el,
	create_tmp,
	delete_tmp,
	drop_hash,
	forbid_new,
	get_by_locator,
	get_single_locator,
	jclone,
	nimpl,
	parse_args,
	to_ref,
	traverse,
	unique
};
