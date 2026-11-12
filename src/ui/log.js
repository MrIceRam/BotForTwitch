// Журнал бота. Перехватывает console.log / console.error всего бота (и библиотек),
// чтобы в режиме интерфейса всё попадало в панели «Логи» и «Ошибки», а не ломало экран.
// Ещё всё пишется в файл logs/ГГГГ-ММ-ДД.log (папка logs в .gitignore) — можно посмотреть после стрима.
const util = require('util');
const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 2000;
const LOG_DIR = process.env.BOT_LOG_DIR || path.join(__dirname, '..', '..', 'logs');
const entries = [];          // { time: Date, level: 'info' | 'warn' | 'error', text }
const listeners = new Set();
const original = {};
let passthrough = true;      // пока интерфейс не запущен — печатаем в обычную консоль как раньше
let toFile = false;
let fileDay = null;
let fileStream = null;

const two = (n) => String(n).padStart(2, '0');
const LEVEL = { info: 'INFO ', warn: 'WARN ', error: 'ERROR' };

function writeFile(entry) {
    try {
        const d = entry.time;
        const day = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
        if (day !== fileDay) { // новый день — новый файл
            if (fileStream) fileStream.end();
            fs.mkdirSync(LOG_DIR, { recursive: true });
            fileStream = fs.createWriteStream(path.join(LOG_DIR, `${day}.log`), { flags: 'a' });
            fileStream.on('error', () => { toFile = false; });
            fileDay = day;
        }
        const time = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
        fileStream.write(`${time} ${LEVEL[entry.level] || entry.level} ${entry.text.replace(/\r?\n/g, '\n                ')}\n`);
    } catch {
        toFile = false; // не получилось писать в файл — работаем дальше без него
    }
}

function add(level, text) {
    const entry = { time: new Date(), level, text: String(text) };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    if (toFile) writeFile(entry);
    for (const fn of listeners) fn(entry);
    return entry;
}

// file: true — ещё и писать в logs/
function capture({ file = false } = {}) {
    toFile = file;
    if (original.log) return;
    const levels = { log: 'info', info: 'info', warn: 'warn', error: 'error' };
    for (const [method, level] of Object.entries(levels)) {
        original[method] = console[method].bind(console);
        console[method] = (...args) => {
            add(level, util.format(...args));
            if (passthrough) original[method](...args);
        };
    }
    // console.debug пишет comfy.js каждые ~10 секунд ("Keepalive received") — это шум, не показываем
    original.debug = console.debug.bind(console);
    console.debug = () => {};
}

module.exports = {
    entries,
    add,
    capture,
    info: (text) => console.log(text),
    error: (text) => console.error(text),
    onEntry: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    setPassthrough: (on) => { passthrough = on; },
    clear: () => { entries.length = 0; },
    // печать мимо журнала — например, после выхода из интерфейса
    print: (...args) => (original.log || console.log)(...args)
};
