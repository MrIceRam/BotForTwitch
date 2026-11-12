// Реклама стрима в чате DDNet: текст, как часто отправлять и включена ли.
// Настройки хранятся в config/ad.json — их можно менять из интерфейса (инструмент «Реклама») или прямо в файле.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'config', 'ad.json');
const DEFAULTS = { enabled: true, intervalMinutes: 5, text: '' };
const MAX_LENGTH = 200;
const MIN_MINUTES = 1;
const MAX_MINUTES = 180;

let settings = load();
let send = null;      // функция отправки, её даёт index.js: async (text) => true/false
let timer = null;
let nextAt = null;    // когда следующая отправка (мс)

function load() {
    try {
        return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
    } catch {
        return { ...DEFAULTS };
    }
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(settings, null, 4) + '\n');
}

function schedule() {
    clearInterval(timer);
    timer = null;
    nextAt = null;
    if (!send || !settings.enabled || !settings.text) return;
    const ms = settings.intervalMinutes * 60 * 1000;
    nextAt = Date.now() + ms;
    timer = setInterval(() => {
        nextAt = Date.now() + ms;
        send(settings.text);
    }, ms);
}

function start(sendFn) {
    send = sendFn;
    schedule();
}

function setText(text) {
    const value = String(text).trim();
    if (!value) throw new Error('Текст пустой');
    if (value.includes(';')) throw new Error('Символ ; нельзя: в консоли DDNet он разделяет команды');
    if ([...value].length > MAX_LENGTH) throw new Error(`Не больше ${MAX_LENGTH} символов`);
    settings.text = value;
    save();
    schedule();
    return 'Текст рекламы сохранён';
}

function setIntervalMinutes(value) {
    const n = Number(String(value).trim().replace(',', '.'));
    if (!Number.isInteger(n) || n < MIN_MINUTES || n > MAX_MINUTES) {
        throw new Error(`Нужно целое число минут от ${MIN_MINUTES} до ${MAX_MINUTES}`);
    }
    settings.intervalMinutes = n;
    save();
    schedule();
    return `Реклама каждые ${n} мин`;
}

function setEnabled(on) {
    settings.enabled = !!on;
    save();
    schedule();
    return on ? 'Реклама включена' : 'Реклама выключена';
}

const toggle = () => setEnabled(!settings.enabled);

// Отправить сразу; true — ушло в DDNet
async function sendNow() {
    if (!send) throw new Error('Бот ещё не запущен');
    if (!settings.text) throw new Error('Текст рекламы пустой');
    return send(settings.text);
}

const get = () => ({ ...settings, nextAt });

module.exports = { start, setText, setIntervalMinutes, setEnabled, toggle, sendNow, get, MAX_LENGTH };
