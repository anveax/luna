#!/usr/bin/env node

/*

	Creates a dump-visualization html page.
	Consumes trace file prepared by extract_trace.js and a directory
	with dump files.

*/

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ------------------------------------------------------------
// Helper: read value from dump file according to type
function readDumpValue(filePath, type) {
    try {
        const stat = fs.statSync(filePath);
        if (type === 'int32') {
            if (stat.size !== 4) return 'invalid size';
            const buf = fs.readFileSync(filePath);
            return buf.readInt32LE(0);
        } else if (type === 'real64') {
            if (stat.size !== 8) return 'invalid size';
            const buf = fs.readFileSync(filePath);
            return buf.readDoubleLE(0);
        } else if (type === 'blob') {
            const size = stat.size;
            const buf = fs.readFileSync(filePath);
            const hash = zlib.crc32(buf).toString(16).padStart(8, '0');
            return `hash:${hash} size:${size}`;
        } else {
            return `unknown type ${type}`;
        }
    } catch (e) {
        return `error: ${e.message}`;
    }
}

// ------------------------------------------------------------
// Parse command line arguments
if (process.argv.length < 4) {
    console.error('Usage: node visualize.js <log.json> <dump_dir>');
    process.exit(1);
}
const logFile = process.argv[2];
const dumpDir = process.argv[3];

// ------------------------------------------------------------
// Read log file
let logData;
try {
    const content = fs.readFileSync(logFile, 'utf8');
    logData = JSON.parse(content);
} catch (e) {
    console.error('Failed to read log file:', e.message);
    process.exit(1);
}

// ------------------------------------------------------------
// Read dump directory and build map: key = `${varid}:${type}` -> file path
const dumpMap = new Map();
try {
    const files = fs.readdirSync(dumpDir);
    for (const file of files) {
        // Expected pattern: _dump_<varid>_<type>
        const match = file.match(/^_dump_(.+)_(int32|real64|blob)$/);
        if (match) {
            const varid = match[1];
            const type = match[2];
            const key = `${varid}:${type}`;
            dumpMap.set(key, path.join(dumpDir, file));
        }
    }
} catch (e) {
    console.error('Failed to read dump directory:', e.message);
    process.exit(1);
}

// ------------------------------------------------------------
// Generate HTML
let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Execution Visualization</title>
    <style>
        body { font-family: sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
        th { background-color: #f0f0f0; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .arg-list { list-style: none; margin: 0; padding: 0; }
        .arg-item { margin-bottom: 4px; }
        .kind-in { color: #d14; font-weight: bold; }
        .kind-out { color: #1a7; font-weight: bold; }
        .varid { font-family: monospace; }
        .type { color: #666; font-style: italic; }
        .value { font-family: monospace; background: #eee; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>Execution Log Visualization</h1>
    <table>
        <thead>
            <tr><th>#</th><th>Code</th><th>Arguments</th></tr>
        </thead>
        <tbody>
`;

logData.forEach((op, idx) => {
    const code = op.code || '?';
    const args = op.args || [];

    // Build argument list items
    const argItems = args.map(arg => {
        const kind = arg.kind === 'input' ? 'in' : 'out';
        const varid = arg.varid;
        const type = arg.type;
        const key = `${varid}:${type}`;
        const filePath = dumpMap.get(key);
        let value;
        if (!filePath) {
            value = '<span class="value">no dump</span>';
        } else {
            const raw = readDumpValue(filePath, type);
            value = `<span class="value">${raw}</span>`;
        }
        return `<li class="arg-item">
            <span class="kind-${arg.kind}">[${kind}]</span>
            <span class="varid">${varid}</span> :
            <span class="type">${type}</span> =
            ${value}
        </li>`;
    }).join('');

    html += `<tr>
        <td>${idx + 1}</td>
        <td><strong>${code}</strong></td>
        <td><ul class="arg-list">${argItems}</ul></td>
    </tr>\n`;
});

html += `</tbody></table></body></html>`;

// ------------------------------------------------------------
// Write output to file or stdout
const outputFile = 'output.html';
fs.writeFileSync(outputFile, html);
console.log(`Visualization generated: ${outputFile}`);
