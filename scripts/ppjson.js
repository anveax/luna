#!/usr/bin/env node

const HELP_MSG=`\
Pretty print JSON
Usage:
	cat "<json data>" | node ./ppjson.js`;

const fs = require('fs');

var data = fs.readFileSync(0, 'utf-8');
console.log(JSON.stringify(JSON.parse(data), null, 2));
