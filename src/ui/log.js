// Журнал бота. Перехватывает console.log / console.error всего бота (и библиотек),
// чтобы в режиме интерфейса всё попадало в панели «Логи» и «Ошибки», а не ломало экран.
const util = require('util');

const MAX_ENTRIES = 2000;
const entries = [];          // { time: Date, level: 'info' | 'warn' | 'error', text }
const listeners = new Set();
const original = {};
let passthrough = true;      // пока интерфейс не запущен — печатаем в обычную консоль как раньше

function add(level, text) {
    const entry = { time: new Date(), level, text: String(text) };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    for (const fn of listeners) fn(entry);
    return entry;
}

function capture() {
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
