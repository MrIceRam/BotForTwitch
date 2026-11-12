// Оверлей для OBS: маленький веб-сервер на этом компьютере.
// В OBS добавляется источник «Браузер» со ссылкой http://localhost:7777 — и на стриме видно:
//   - кто какую награду за баллы купил;
//   - новых фолловеров, подписки, рейды и биты (каждый вид можно выключить — config/overlay.json или окно бота);
//   - плашку с обратным отсчётом, пока идёт реверс.
// Страница оверлея — src/overlay/overlay.html (её можно менять, бот перечитывает файл при каждом открытии).
// Порт можно поменять строкой OVERLAY_PORT=7777 в .env.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const PAGE = path.join(__dirname, '..', 'overlay', 'overlay.html');
const SETTINGS_FILE = path.join(__dirname, '..', '..', 'config', 'overlay.json');
const HISTORY_MAX = 20;   // сколько последних событий помнит лента (?mode=feed)

// Как выглядят алерты (не награды): иконка, цвет, подпись сверху
const ALERTS = {
    follow: { name: 'Фолловы', icon: '💜', color: '#a970ff', label: 'Новый фолловер' },
    sub: { name: 'Подписки', icon: '⭐', color: '#ffd43b', label: 'Подписка' },
    raid: { name: 'Рейды', icon: '🚀', color: '#ff6b6b', label: 'Рейд' },
    cheer: { name: 'Биты', icon: '💎', color: '#20c997', label: 'Биты' }
};

const clients = new Set(); // открытые страницы оверлея (OBS, браузер)
const history = [];
const effects = new Map(); // идущие эффекты (реверс) — чтобы показать их и только что подключившемуся OBS
let port = Number(process.env.OVERLAY_PORT) || 7777;
let running = false;
let error = '';
let nextId = 1;
let settings = loadSettings();

const url = (feed = false) => `http://localhost:${port}${feed ? '/?mode=feed' : ''}`;

// ---------- настройки: какие алерты показывать ----------
function loadSettings() {
    const defaults = { alerts: Object.fromEntries(Object.keys(ALERTS).map((k) => [k, true])) };
    try {
        const file = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        return { ...defaults, ...file, alerts: { ...defaults.alerts, ...(file.alerts || {}) } };
    } catch {
        return defaults;
    }
}

const alertEnabled = (kind) => settings.alerts[kind] !== false;

function toggleAlert(kind) {
    settings.alerts[kind] = !alertEnabled(kind);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 4) + '\n');
    return `${ALERTS[kind].name} на оверлее: ${alertEnabled(kind) ? 'включены' : 'выключены'}`;
}

const alertKinds = () => Object.entries(ALERTS).map(([kind, a]) => ({ kind, name: a.name }));

// ---------- веб-сервер ----------
function send(event, data, to = clients) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of to) res.write(message);
}

function handle(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/events') {
        // поток событий: страница сама переподключается, если бота перезапустили
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        res.write('retry: 2000\n\n');
        send('history', history, [res]);
        for (const effect of effects.values()) send('effect', effect, [res]);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
    }
    if (pathname === '/test') {
        test();
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ok');
        return;
    }
    if (pathname === '/' || pathname === '/index.html') {
        fs.readFile(PAGE, (err, html) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Не нашёл страницу оверлея: ${PAGE}`);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
            res.end(html);
        });
        return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Нет такой страницы');
}

function start() {
    const server = http.createServer(handle);
    server.on('error', (err) => {
        error = err.code === 'EADDRINUSE' ? `порт ${port} занят` : err.message;
        console.error(`Оверлей для OBS не запустился: ${error}. Поменяйте порт строкой OVERLAY_PORT=7778 в .env`);
    });
    // только для этого компьютера — снаружи оверлей не открыть
    server.listen(port, '127.0.0.1', () => {
        port = server.address().port;
        running = true;
        console.log(`Оверлей для OBS: ${url()}`);
    });
    // пустое сообщение раз в 15 секунд, чтобы соединение с OBS не засыпало
    setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000).unref?.();
    return server;
}

// ---------- события ----------
function push(item, test = false) {
    const full = { id: nextId++, time: Date.now(), test, ...item };
    if (!test) {
        history.push(full);
        if (history.length > HISTORY_MAX) history.shift();
    }
    send('alert', full);
    return full.id;
}

// Награду купили. Возвращает id — по нему потом можно отметить возврат баллов.
function redemption({ user, reward, cost, text, icon, color, userColor, test = false }) {
    return push({ kind: 'reward', user, reward, cost, text: text || '', icon: icon || '🎁', color: color || '', userColor: userColor || '' }, test);
}

// Фоллов, подписка, рейд, биты. verb — что сделал, title — подробности (например, «3 мес. подряд»).
// Если этот вид алертов выключен — ничего не показывает и возвращает null.
function alert(kind, { user, verb, title = '', text = '', userColor = '', test = false }) {
    if (!alertEnabled(kind)) return null;
    const a = ALERTS[kind];
    return push({ kind, user, verb, title, text, icon: a.icon, color: a.color, label: a.label, userColor }, test);
}

// Награда не сработала и баллы вернулись — оверлей покажет это на карточке
function refunded(id, reason) {
    const item = history.find((h) => h.id === id);
    if (item) Object.assign(item, { refunded: true, reason });
    send('refund', { id, reason });
}

// Плашка с обратным отсчётом (реверс). Возвращает id для effectEnd.
function effectStart({ icon, title, user, seconds, color }) {
    const effect = { id: nextId++, icon, title, user, seconds, color, endsAt: Date.now() + seconds * 1000 };
    effects.set(effect.id, effect);
    send('effect', effect);
    return effect.id;
}

function effectEnd(id) {
    if (!effects.delete(id)) return;
    send('effect-end', { id });
}

function test() {
    const samples = [
        () => redemption({ user: 'Зритель', reward: 'Тестовая награда', cost: 100, text: 'Проверка оверлея 🔥', icon: '🎁', test: true }),
        () => redemption({ user: 'Зритель', reward: 'Сообщение в чат Доты', cost: 50, text: 'gl hf 😎', icon: '💬', color: '#4dabf7', test: true }),
        () => push({ kind: 'follow', user: 'Зритель', verb: 'теперь фолловит канал', icon: ALERTS.follow.icon, color: ALERTS.follow.color, label: ALERTS.follow.label }, true),
        () => push({ kind: 'sub', user: 'Зритель', verb: 'подписался(ась)', title: '3 мес. подряд', text: 'Лучший стрим!', icon: ALERTS.sub.icon, color: ALERTS.sub.color, label: ALERTS.sub.label }, true),
        () => push({ kind: 'raid', user: 'Стример', verb: 'пришёл(ла) с рейдом', title: '42 зрителя', icon: ALERTS.raid.icon, color: ALERTS.raid.color, label: ALERTS.raid.label }, true)
    ];
    return samples[Math.floor(Math.random() * samples.length)]();
}

function copyLink(feed = false) {
    return new Promise((resolve, reject) => {
        const clip = spawn('clip', [], { stdio: ['pipe', 'ignore', 'ignore'] });
        clip.on('error', () => reject(new Error(`Не получилось скопировать. Ссылка: ${url(feed)}`)));
        clip.on('close', () => resolve(`Скопировано: ${url(feed)}`));
        clip.stdin.end(url(feed));
    });
}

function openInBrowser(feed = false) {
    exec(`start "" "${url(feed)}"`);
    return `Открываю ${url(feed)}`;
}

const status = () => ({ running, error, clients: clients.size, url: url() });

module.exports = {
    start, redemption, alert, refunded, effectStart, effectEnd, test,
    alertKinds, alertEnabled, toggleAlert,
    copyLink, openInBrowser, status, url
};
