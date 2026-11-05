
const FORMATS_C = {
	'int32': 'int'
}

function is_format_supported(format) {
	return format in FORMATS_C;
}

module.exports = {
	is_format_supported
}
