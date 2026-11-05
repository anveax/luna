const { spawn } = require('child_process');

const { nimpl } = require("./common.js");
const log = require("./log.js").log;

function exec_command(command, stdin, cb) {
    const [cmd, ...args] = command;
    log(...command);

    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let called = false; // флаг для предотвращения двойного вызова

    // Сбор данных из stdout
    child.stdout.on('data', (chunk) => {
        stdout = Buffer.concat([stdout, chunk]);
    });

    // Сбор данных из stderr
    child.stderr.on('data', (chunk) => {
        stderr = Buffer.concat([stderr, chunk]);
    });

    // Передаём stdin и закрываем
    if (stdin) {
        child.stdin.write(stdin);
    }
    child.stdin.end();

    // Ошибки запуска
    child.on('error', (err) => {
        if (!called) {
            called = true;
            log("EXEC:ERROR", err);
            cb(-1, stdout, Buffer.from(err.message));
        }
    });

    // Завершение процесса
    child.on('close', (code, signal) => {
        if (!called) {
            called = true;
            if (code !== null) {
                // Нормальное завершение с кодом
                log("EXEC:CLOSE", code);
                cb(code, stdout, stderr);
            } else {
                // Процесс убит сигналом
                log("EXEC:CLOSE", signal);
                cb(-1, stdout, Buffer.from(`Killed by signal: ${signal}`));
            }
        }
    });
}

module.exports = exec_command;
