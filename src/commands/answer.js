// Автоответы на фразы в чате. Сами фразы и ответы — в config/answers.json:
// их можно менять без правки кода, бот подхватывает изменения файла на лету.
// Сравнение без учёта регистра, ё/е, лишних пробелов и знаков в конце: «Окак», «окак!» и «окак?» — одно и то же.
// Ответ в файле может быть:
//   "строкой"                    — всегда этот ответ
//   ["вариант 1", "вариант 2"]   — случайный из списка
//   { "Нет": 50, "да": 1 }        — случайный с весами: «да» в 1 случае из 51
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'config', 'answers.json');
const CHECK_MS = 2000; // не чаще раза в 2 секунды проверяем, не поменялся ли файл

let answers = new Map();
let loadedMtime = 0;
let lastCheck = 0;

const normalize = (s) => String(s)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .replace(/[\s.!?…,)]+$/u, '')
    .trim();

function load() {
    const now = Date.now();
    if (now - lastCheck < CHECK_MS) return;
    lastCheck = now;
    let mtime;
    try { mtime = fs.statSync(FILE).mtimeMs; } catch { answers = new Map(); return; }
    if (mtime === loadedMtime) return;
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        answers = new Map(Object.entries(data)
            .filter(([phrase]) => !phrase.startsWith('_'))
            .map(([phrase, reply]) => [normalize(phrase), reply]));
        if (loadedMtime) console.log(`Автоответы обновлены: ${answers.size} фраз`);
    } catch (err) {
        console.error(`config/answers.json: ошибка в файле — ${err.message}. Пока работают прежние автоответы`);
    }
    loadedMtime = mtime;
}

function pick(reply) {
    if (typeof reply === 'string') return reply;
    if (Array.isArray(reply)) return reply.length ? String(reply[Math.floor(Math.random() * reply.length)]) : 0;
    if (reply && typeof reply === 'object') {
        const options = Object.entries(reply).filter(([, weight]) => Number(weight) > 0);
        let r = Math.random() * options.reduce((sum, [, weight]) => sum + Number(weight), 0);
        for (const [text, weight] of options) if ((r -= Number(weight)) < 0) return text;
    }
    return 0;
}

// Ответ на сообщение или 0, если отвечать не нужно
function answer(message) {
    load();
    const reply = answers.get(normalize(message));
    return reply === undefined ? 0 : pick(reply);
}

module.exports = { answer, normalize };
