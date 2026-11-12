// Сообщения чата Twitch для панели «Чат» в окне бота.
// Бот кладёт сюда всё, что видит в чате (src/index.js), а окно показывает.
const MAX_ENTRIES = 500;

// { time: Date, kind, user, color, text, reward, cost }
//   kind: 'message' — обычное сообщение, 'command' — !команда, 'bot' — сообщение самого бота,
//         'reward' — погашение награды за баллы
const entries = [];
const listeners = new Set();

function add(entry) {
    const e = { time: new Date(), kind: 'message', user: '', color: null, text: '', ...entry };
    entries.push(e);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    for (const fn of listeners) fn(e);
    return e;
}

module.exports = {
    entries,
    add,
    onEntry: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    clear: () => { entries.length = 0; }
};
