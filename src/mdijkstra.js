function clone(obj)
{
	return JSON.parse(JSON.stringify(obj));
}
/**
	Return array, containing only unique elements
 */
function get_unique(arr)
{
	let unique={};

	for(let i in arr) {
		let val=arr[i];
		unique[val]=null;
	}

	return Object.keys(unique);
}

/**
	Modified Dijkstra algorithm for planning on computational models

	@param V: a list of variables considered computed
	@param W: a list of variables to compute
	@param get_consumers: a function, which returns a dict of all
		operations descriptor, that have given var_id as input: {
		<op_id>: {
			ins: ["<var_id>"...],
			outs: ["<var_id>"...],
			price: <number> (optional)
		}
	}

	@return a list of operations ids, which comprise the plan
 */
function mdijkstra(V, W, get_consumers)
{
	var price = op => op.price === undefined? 1: op.price;
	V=get_unique(V);
	W=get_unique(W);

	let marks={}
	V.forEach(v => marks[v] = 0);
	
	let il_vars={};
	let inputless=get_consumers();
	for (let opid in inputless) {
		let op=inputless[opid];

		if (op.ins && op.ins.length!=0) {
			console.error(op, new Error().stack);
			throw "illegal consumer";
		}


		for (let w of op.outs) {
			if (!(w in marks) || marks[w]>price(op)) {
				marks[w]=price(op);
				il_vars[w]=opid;
			}
		}
	}

	let best_op={}
	let visited={}

	// while not W <= V
	while (!W.every(x => V.includes(x))) {
		let nearest=null;

		// Find the nearest not visited x
		for (let x in marks) {
			if (x in visited) {
				continue;
			}

			if (nearest==null || marks[nearest]>marks[x])
				nearest=x;
		}

		if (nearest==null)
			break;

		let ops=get_consumers(nearest);

		for (let opid in ops) {
			let op=ops[opid];

			let ins_ready=true;
			let op_mark=null;

			for (let x of op['ins']) {
				if (!(x in marks)) {
					ins_ready=false;
					break;
				}

				if (op_mark==null || marks[x]>op_mark) {
					op_mark=marks[x];
				}
			}

			if (!ins_ready)
				continue;

			op_mark+=price(op);

			// this op is computable, try improving the marks

			for (let x of op['outs']) {
				if (x in visited)
					continue;

				if (x in marks==false || marks[x]>op_mark) {
					marks[x]=op_mark;
					best_op[x]=[opid, op];
				}
			}
		}

		visited[nearest]=null;
	}

	for (let w of W) {
		if (!(w in marks)) {
			// vertex unreachable
			return { plan: null, sequence: null, score: null };
		}
	}

	let queue=clone(W);

	let result={};
	var sequence = [];

	while (queue.length) {
		let w=queue.pop();

		if (!(w in best_op)) {
			if (!(V.includes(w)) && !(w in il_vars)) {
				throw Error('ASSERT');
			}
			continue;
		}

		let opid=best_op[w][0], op=best_op[w][1];

		if (opid in result)
			continue;

		result[opid]=null;
		sequence.push(opid);

		for (let v of op.ins) {
			if (v in il_vars) {
				// add inputless vars
				result[il_vars[v]]=null;
				sequence.push(il_vars[v]);
			}
		}

		op['ins'].forEach(x => {
			if (!queue.includes(x)) {
				queue.push(x);
			}
		});
	}

	// Add to result all inputless W
	W.forEach(w => {
		if (w in il_vars) {
			result[il_vars[w]]=null;
			sequence.push(il_vars[w]);
		}
	});

	let score=null;

	W.forEach(w => {
		if (score==null || score<marks[w])
			score=marks[w];
	});

	sequence.reverse();
	/* TODO: BUG: sequence is computed incorrectly:
	(that's why we use get_sequence instead)
	{
		"V":["X_raw:0","X_raw:1","opora","N"],
		"W":["S1_size"],
		"info":{
			"_l17":{"ins":["opora","N"],"outs":["Fs","L","M","p","S:0"]},
			"_l21":{"ins":["M","p"],"outs":["W"]},
			"_l23":{"ins":["S:0","W","M","p"],"outs":["S:1"]},
			"_l27":{"ins":["S:1"],"outs":["S1_size"]}
		}
	}
*/

	// compute sequence alternatively
	var { seq, info } =
		get_sequence(V, W, get_consumers, Object.keys(result));

	return {
		plan: Object.keys(result),
		sequence: seq, score
	}
}

function get_sequence(V, W, get_consumers, plan) {
	// get all ops without deps:
	var info = {};
	var seq = [];
	var known_vars = [];
	function add_known_vars(vars) {
		var useful = false;
		vars.forEach(x => {
			if (known_vars.indexOf(x) === -1) {
				useful = true;
				known_vars.push(x);
			}
		});
		return useful;
	}
	add_known_vars(V);

	function append(opid, op) {
		if (seq.indexOf(opid) !== -1)
			return;

		seq.push(opid);
		add_known_vars(op.outs);
		info[opid] = op;
	}

	// append inputless
	var ops = get_consumers();
	for (var opid in ops) {
		if (plan.indexOf(opid) === -1)
			continue; // not in the plan
		append(opid, ops[opid]);
	}

	function all_inputs_ready(vars) {
		for (var x of vars)
			if (known_vars.indexOf(x) === -1)
				return false;
		return true;
	}

	while (seq.length < plan.length) {
		var useful = false;
		for (var x of known_vars) {
			var ops = get_consumers(x);
			for (var opid in ops) {
				if (plan.indexOf(opid) === -1)
					continue;
				if (!all_inputs_ready(ops[opid].ins))
					continue;
				useful = true;
				append(opid, ops[opid]);
			}
		}
		if (!useful)
			throw Error("corrupted plan");
	}

	if (seq.length !== plan.length)
		throw Error();
	return { seq, info };
}

module.exports = mdijkstra;
