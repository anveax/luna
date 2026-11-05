#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {nimpl} = require("../src/common.js");

import { fileURLToPath } from 'url';
import path from 'path';


async function readLines(input_path) {
    const lines = [];
    const rl = readline.createInterface({
        input: fs.createReadStream(input_path),
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        lines.push(line);
    }

    return lines;
}

const execute = require("../src/execute.js");

// Оборачиваем всё в async-функцию
async function main() {
    // ---------- read stdin ----------
    const lines = fs.readFileSync(0, 'utf-8')
        .split('\n')
        .filter(x => x.length > 0);

    assert(lines.length >= 4, "Expected codefrag directory path");

    const code_path = path.resolve(lines[0]);
    const plan_path = path.resolve(lines[1]);
    const input_path = path.resolve(lines[2]);
    const output_path = path.resolve(lines[3]);

    // ---------- read AZ environment variable ----------
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const sys_dir = path.resolve(__dirname, '../..');

    // const sys_dir = process.env.AZ;
    assert(sys_dir !== undefined, "Environment variable AZ is not set");
    const sys_dir_abs = path.resolve(sys_dir);

    // ---------- prepare args ----------
    const plan = JSON.parse(fs.readFileSync(plan_path, 'utf-8'));
    const args = plan.iface.main.params;

    for (let i = 0; i < args.length; i++) {
        args[i].id = i;
    }

    for (let i = 0, count_input = 0, flag = false; i < args.length; i++) {
        if (args[i].kind === 'input') {
            count_input++;
            if (args[i].format === 'stdin') {
                flag = true;
            }
        }
        if (flag && count_input > 1) {
            nimpl(args);
        }
    }

    const values = {};
    let stdout = '';

    // remaining stdin lines = input values
    // const lines_input = await readLines(input_path);
    const lines_input = fs.readFileSync(input_path, 'utf-8')
        .split('\n')
        .filter(x => x.length > 0);
    for (let i = 0, id = 0; id < args.length; i++, id++) {
        if (args[id].kind === 'input' && args[id].format === 'stdin') {
            break;
        }
        if (args[id].kind !== 'input' && args[id].format !== 'path') {
            i--;
            continue;
        }
        values[id] = lines_input[i];
    }
    // value provider
    function value_provider(arg) {
        switch (arg.kind) {
            case 'input':
                if (arg.format === 'path') {
                    return fs.readFileSync(values[arg.id]);
                } else if (arg.format === 'stdin') {
                    return fs.readFileSync(input_path);
                } else if (arg.format === 'stdout') {
                    nimpl(arg);
                }

                if (arg.type !== 'int32' && arg.type !== 'real64')
                    nimpl(arg);

                return values[arg.id];
            default:
                nimpl(arg);
        }
        nimpl(arg);
    }

    // output callback
    function cb(arg, result) {
        if (arg.kind !== 'output') nimpl();
        switch (arg.format) {
            case 'path':
                fs.writeFileSync(values[arg.id], result.value);
                break;
            case 'stdin':
                nimpl();
                break;
            default:
                stdout += `${result.value}\n`;
                break;
        }
    }

    // finish callback
    function end_cb() {
        fs.writeFileSync(output_path, stdout);
    }

    // ---------- execute ----------
    execute(
        sys_dir_abs,
        code_path,
        args,
        value_provider,
        cb,
        end_cb
    );
}

// запускаем main()
main().catch(err => {
    console.error(err);
    process.exit(1);
});