const { create_bar } = require("./bar.js");
const { nimpl } = require("../src/common.js");

function init(what) {
	if (what !== 'one')
		return null;

	return cb => {
		cb(what, 'int32', 1);
	}
}

function inc(what) {
	if (what !== 'two')
		return null;

	if (this.is_true('one')) {
		return cb => {
			cb(what, 'int32', this.get_value('one'));
		};
	} else if (this.is_false('one')) {
		return cb => {
			cb(what, null);
		};
	} else {
		return ['one'];
	}
}

var bar = create_bar();
bar.push(init);
bar.push(inc);
bar.demand('two', console.log);
