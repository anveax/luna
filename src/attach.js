const assert = require('assert');
const fs = require('fs');

function attach(jaz, field, name, item) {
	if (!(field in jaz))
		jaz[field] = {};

	assert(!(name in jaz[field]));
	jaz[field][name] = item;

	return jaz;
}

module.exports = attach;