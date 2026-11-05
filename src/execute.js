const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { abort, create_tmp, delete_tmp, nimpl } = require("./common.js");
const exec_cmd = require("./exec_cmd.js");
const { log } = require("./log.js");

function create_temp_dir() {
	var prefix = path.join(os.tmpdir(), 'myapp-');
	var dir = fs.mkdtempSync(prefix);
	return dir;
}

function execute_cpf(sys_dir, code_path, args, value_provider, cb,
		end_cb, fail_cb) {
	assert(typeof end_cb === "function");
	// Create wrapper for cpf;
	var temp_path = create_temp_dir();
	var manifest = JSON.parse(fs.readFileSync(path.join(code_path,
		'manifest.json')).toString());

	var script_dir = path.dirname(__filename);
	exec_cmd(['node', path.join(script_dir, 
		'../scripts/gen_clif_cpf_wrapper.js')],
			`${code_path}\n${temp_path}\n`,
			(code, stdout, stderr) => {
		assert(code===0, stderr.toString());
		compile();
	});

	// Compile
	// TODO: replace with make 
	function compile() {
		// TODO remove /user/ paths
		var cmd = ['gcc', '-g', `${temp_path}/code.c`,
			`${sys_dir}/src/clif.c`,
			'-I', `${sys_dir}/src`];
		var sources = manifest.src;
		if (typeof sources === "string")
			sources = [sources];
		sources.forEach(src =>
			cmd.push(`${code_path}/${src}`));
		cmd = cmd.concat(['-lm', '-o', `${temp_path}/a.out`])
		exec_cmd(cmd, '', (code, o, e) => {
			if (code !== 0) {
				abort("compile failed", manifest, e.toString());
			}
			assert(code === 0);
			execute_codefrag();
		});

		var clif_mf = JSON.parse(fs.readFileSync(
			path.join(temp_path, 'manifest.json')).toString());
		clif_mf.executable = `${temp_path}/a.out`
		fs.writeFileSync(path.join(temp_path, 'manifest.json'),
			JSON.stringify(clif_mf, null, 2));
	}

	function execute_codefrag() {
		execute_clif(temp_path, args, value_provider, cb, () => {
			fs.rmSync(temp_path, { recursive: true, force: true });
			end_cb();
		}, fail_cb);
	}
}

function execute_clif(code_path, args, value_provider, cb, cleanup_cb,
		fail_cb) {
	if (typeof fail_cb === "undefined")
		abort(fail_cb);
	if (fail_cb === undefined)
		fail_cb = abort;
	execute_codefrag();
	// Execute
	// TODO: replace with make run
	function execute_codefrag() {
		var clif_mf = JSON.parse(fs.readFileSync(
			path.join(code_path, 'manifest.json')).toString());

		var stdin = '';
		var temp_files = [];

		for (var i=0; i<args.length; i++) {
			var param = clif_mf.params[i];
			switch(param.kind) {
				case 'input':
					if (param.format === 'path') {
						var temp_file = create_tmp();
						fs.writeFileSync(temp_file,
							value_provider(args[i]));
						stdin += `${temp_file}\n`;
						temp_files.push(create_deleter(temp_file));
						break;
					} else if (param.format === 'stdin' && param.type === 'blob') {
						stdin = value_provider(args[i]);
					} else  if (param.format === 'string') {
						if (param.type !== 'int32'
								&& param.type !== 'real64'
								&& param.type !== 'string')
							nimpl(param, args[i], value_provider(args[i]));

						stdin+=`${value_provider(args[i])}\n`;
					} else
						nimpl(param, args[i], value_provider(args[i]));
					break;
				case 'output':
					if (param.format === 'path') {
						var temp_file = create_tmp();
						temp_files.push(create_path_cb(
							args[i], param, temp_file));
						stdin +=`${temp_file}\n`
						break;
					} else if (param.format === 'stdout' && param.type === 'blob') {
						// handle in parse outs? nimpl("do what?");
					} else if (param.format !== 'string')
						nimpl(param);
					break;
				default:
					nimpl();
			}
		}

		function create_deleter(temp_file) {
			return () => {
				delete_tmp(temp_file);
			};
		}

		function create_path_cb(arg, param, temp_file) {
			return () => {
				switch (param.type) {
					case 'blob':
						var blob = fs.readFileSync(temp_file);
						cb(arg, {
							type: param.type,
							value: blob
						});
						delete_tmp(temp_file);
						break;
					default:
						nimpl(arg, param, temp_file);
				}
			};
		}

		// TODO replace with make clean
		var command = clif_mf.executable;
		if (!command.startsWith("/"))
			command = path.join(code_path, command);
		//command = ['valgrind', '--leak-check=full', command];
		command = [command];
		if (clif_mf.exec_args !== undefined)
			command = command.concat(clif_mf.exec_args);
		exec_cmd(command, stdin, (code, o, e) => {
			if (e.toString().length >0)
				console.error(e.toString());
			if (code !== 0)
				return fail_cb(code_path, args, code, o.toString(), e.toString());
			assert(code === 0);
			log(code, o.toString(), e.toString());
			parse_outs(o, clif_mf);
			temp_files.forEach(t => t());
			if (cleanup_cb)
				cleanup_cb();
		});

	}

	// Parse outputs
	function parse_outs(stdout, mf) {
		var lines = stdout.toString().split('\n');
		for (var i=0; i<args.length; i++) {
			var par = mf.params[i];
			if (par.kind !== 'output')
				continue;
			if (par.format === 'path')
				continue; // processed elsewhere
			if (par.format ==='stdout' && par.type === 'blob') {
				// We have a single out... let's call back
				assert(stdout !== null);
				cb(args[i], {
					type: par.type,
					value: stdout
				});
				stdout = null; // just to be sure no other 'stdout' output
				continue;
			}
			if (par.format !== 'string')
				nimpl(par);

			switch(par.type) {
				case 'int32': {
					var line = lines.shift();
					var value = parseInt(line);
					if (Number.isNaN(value)) {
						abort(par, line, value, mf, i);
					}
					cb(args[i], {
						type: par.type,
						value
					});
					break;
				}
				case 'real64': {
					var line = lines.shift();
					var value = parseFloat(line);
					if (Number.isNaN(value)) {
						abort(par, line, value, mf, i);
					}
					cb(args[i], {
						type: par.type,
						value
					});
					break;
				}
				case 'string':
					cb(args[i], {
						type: par.type,
						value: lines.shift()
					});
					break;
				default:
					nimpl(par);
			}
		}
	}

}

function execute_raw(sys_dir, code_path, args, value_provider, cb,
		end_cb, fail_cb) {
	var manifest = JSON.parse(fs.readFileSync(path.join(code_path,
		'manifest.json')).toString());
	switch (manifest.format) {
		case 'cpf':
			return execute_cpf(sys_dir, code_path, args,
				value_provider, cb, end_cb, fail_cb);
		case 'clif':
			return execute_clif(code_path, args, value_provider, cb,
				end_cb, fail_cb);
		default:
			nimpl(manifest, manifest.format);
	}
}

var _queue = [];
var _queue_max_size = 0;
var _running = false;

/*
	value_provider: varid -> value
	cb: (varid, { type, value })
	end_cb: () => {...}
*/
function execute(sys_dir, code_path, args, value_provider, cb, end_cb,
		fail_cb) {
	assert(typeof end_cb === "function");
	_queue.push({sys_dir, code_path, args, value_provider, cb, end_cb,
		fail_cb});
	_check_queue();
}

function _check_queue() {
	if (_queue.length > _queue_max_size)
		_queue_max_size = _queue.length;
	log("QUEUE SIZE", _queue.length, "max:", _queue_max_size, _running);
	if (_queue.length === 0)
		return;

	if (_running)
		return;

	_running = true;

	var job = _queue.shift();

	execute_raw(job.sys_dir, job.code_path, job.args,
			job.value_provider, job.cb, function() {
		assert(_running);
		_running = false;
		job.end_cb();
		process.nextTick(_check_queue);
	}, function() {
		assert(_running);
		_running = false;
		job.fail_cb();
		process.nextTick(_check_queue);
	});

	/*
	if (!_running) {
		_running = true;
		execute_raw(sys_dir, code_path, args, value_provider, cb,
				function() {
			assert(_running);
			_running = false;
			_check_queue();
		});
	}
	*/
}
module.exports = execute;
