const { nimpl } = require("../src/common.js");
const { log } = require("../src/log.js");

function create_const_opers(val) {
	return function(what) {
		if (!/^local:\/\/val\/.*$/.test(what))
			return null;

		var id = what.substr(12);
		if (!(id in val))
			return null;

		return cb => {
			cb(what, val[id].type, val[id].value);
		};
	}
}

module.exports = { create_const_opers };
