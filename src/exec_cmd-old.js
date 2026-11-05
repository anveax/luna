const { spawn } = require('child_process');

const log = require("./log.js").log;

/**
 * Запускает команду и передаёт ей строку на вход.
 * @param {string[]} command - массив вида ['команда', 'аргумент1', ...]
 * @param {string} stdin - строка, которая будет записана в stdin процесса
 * @param {Function} cb - колбэк вида (retcode, stdout, stderr)
 *                        retcode {number} код возврата (или -1 при ошибке запуска)
 *                        stdout {Buffer} данные из stdout
 *                        stderr {Buffer} данные из stderr
 */
function exec_command(command, stdin, cb) {
    // Разделяем команду и аргументы
    const [cmd, ...args] = command;
	log(...command);

    // Запускаем процесс с тремя стандартными потоками в режиме pipe
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);

    // Собираем данные из stdout
    child.stdout.on('data', (chunk) => {
        stdout = Buffer.concat([stdout, chunk]);
    });

    // Собираем данные из stderr
    child.stderr.on('data', (chunk) => {
        stderr = Buffer.concat([stderr, chunk]);
    });

    // Передаём строку в stdin и закрываем поток (сигнал конца ввода)
    if (stdin) {
        child.stdin.write(stdin);
    }
    child.stdin.end();

    // Обрабатываем ошибки запуска (команда не найдена и т.п.)
    child.on('error', (err) => {
        // В случае ошибки вызываем колбэк с кодом -1 и сообщением об ошибке в stderr
		log("EXEC:ERROR", err);
        cb(-1, stdout, Buffer.from(err.message));
    });

    // Когда процесс завершится
    child.on('close', (code) => {
		log("EXEC:CLOSE", code);
        cb(code, stdout, stderr);
    });
}

module.exports = exec_command;
