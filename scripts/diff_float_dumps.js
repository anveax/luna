const fs = require('fs');

// Получаем пути к файлам из аргументов командной строки
const file1 = process.argv[2];
const file2 = process.argv[3];

if (!file1 || !file2) {
    console.error('Использование: node compare_floats.js <файл1> <файл2>');
    process.exit(1);
}

try {
    // Читаем файлы как буферы
    const buffer1 = fs.readFileSync(file1);
    const buffer2 = fs.readFileSync(file2);

    // Проверяем, что размеры кратны 4 (размер float)
    if (buffer1.length % 4 !== 0 || buffer2.length % 4 !== 0) {
        throw new Error('Размер файла не кратен 4 байтам (неверный формат)');
    }

    const count1 = buffer1.length / 4;
    const count2 = buffer2.length / 4;

    if (count1 !== count2) {
        throw new Error(`Количество чисел в файлах различается: ${count1} vs ${count2}`);
    }

    if (count1 === 0) {
        console.log('0'); // Оба файла пусты — разность равна нулю
        process.exit(0);
    }

    let sumSq = 0;

    // Последовательно читаем числа из буферов (little-endian)
    for (let i = 0; i < count1; i++) {
        const a = buffer1.readFloatLE(i * 4);
        const b = buffer2.readFloatLE(i * 4);
        const diff = a - b;
        sumSq += diff * diff;
    }

    const rmse = Math.sqrt(sumSq / count1);
    console.log(rmse);

} catch (err) {
    console.error('Ошибка:', err.message);
    process.exit(1);
}
