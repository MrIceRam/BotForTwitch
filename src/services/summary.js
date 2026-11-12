// Итоги стрима: сколько шёл, сколько писали в чат, кто писал больше всех, какие награды купили,
// сколько новых фолловеров, подписок и рейдов.
// Сохраняются в stats/ГГГГ-ММ-ДД_ЧЧ-ММ.md (папка stats в .gitignore), когда стрим заканчивается,
// или по инструменту «Итоги стрима» в окне бота.
// Если бот перезапустился посреди стрима, счёт продолжается (stats/current-session.json).
const fs = require('fs');
const path = require('path');

const DIR = process.env.BOT_STATS_DIR || path.join(__dirname, '..', '..', 'stats');
const SNAPSHOT = path.join(DIR, 'current-session.json');
const TOP_CHATTERS = 10;

const two = (n) => String(n).padStart(2, '0');
const num = (n) => Number(n || 0).toLocaleString('ru-RU');

// 1 зритель, 2 зрителя, 5 зрителей
function plural(n, [one, few, many]) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    return b >= 2 && b <= 4 ? few : many;
}

function fresh(startedAt = null) {
    return {
        startedAt: startedAt ? new Date(startedAt).getTime() : Date.now(),
        live: !!startedAt,        // false — стрима нет, считаем с запуска бота
        peakViewers: 0,
        games: [],
        messages: 0,
        commands: 0,
        chatters: {},             // ник → сколько сообщений
        rewards: {},              // награда → { count, points }
        refunds: 0,
        refundedPoints: 0,
        follows: [],
        subs: 0,
        gifted: 0,
        raids: [],                // [{ user, viewers }]
        bits: 0
    };
}

let s = fresh();

function saveSnapshot() {
    if (!s.live) return;
    try {
        fs.mkdirSync(DIR, { recursive: true });
        fs.writeFileSync(SNAPSHOT, JSON.stringify(s));
    } catch { /* не страшно: итоги просто начнутся заново после перезапуска */ }
}

// ---------- что происходит на стриме ----------
function streamStarted(startedAt) {
    const start = new Date(startedAt).getTime();
    try { // бот перезапускался посреди этого же стрима — продолжаем счёт
        const old = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
        if (old.startedAt === start) {
            s = { ...fresh(startedAt), ...old, live: true };
            console.log('Итоги стрима: продолжаю считать с прошлого запуска бота');
            return;
        }
    } catch { /* снимка нет — начинаем заново */ }
    s = fresh(startedAt);
    saveSnapshot();
}

function streamEnded() {
    if (!s.live) return null;
    const file = save();
    try { fs.unlinkSync(SNAPSHOT); } catch { /* уже нет */ }
    s = fresh();
    return file;
}

function viewers(n) { if (n > s.peakViewers) s.peakViewers = n; }
function game(name) { if (name && !s.games.includes(name)) s.games.push(name); }
function message(user) { s.messages++; s.chatters[user] = (s.chatters[user] || 0) + 1; }
function command(user) { s.commands++; message(user); }
function reward(title, cost) {
    const r = s.rewards[title] || (s.rewards[title] = { count: 0, points: 0 });
    r.count++;
    r.points += Number(cost) || 0;
}
function refund(cost) { s.refunds++; s.refundedPoints += Number(cost) || 0; }
function follow(user) { if (!s.follows.includes(user)) s.follows.push(user); }
function sub(gifted = 1, isGift = false) { s.subs += gifted; if (isGift) s.gifted += gifted; }
function raid(user, count) { s.raids.push({ user, viewers: Number(count) || 0 }); }
function cheer(bits) { s.bits += Number(bits) || 0; }

// ---------- текст итогов ----------
function duration(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    return `${Math.floor(m / 60)}:${two(m % 60)}`;
}

function text() {
    const start = new Date(s.startedAt);
    const date = `${two(start.getDate())}.${two(start.getMonth() + 1)}.${start.getFullYear()}`;
    const lines = [];
    lines.push(`# Итоги стрима ${date}`, '');
    lines.push(`- ${s.live ? 'Начало стрима' : 'Бот запущен'}: ${two(start.getHours())}:${two(start.getMinutes())}, прошло ${duration(Date.now() - s.startedAt)} (ч:мм)`);
    if (s.games.length) lines.push(`- Игры: ${s.games.join(', ')}`);
    if (s.peakViewers) lines.push(`- Пик зрителей: ${num(s.peakViewers)}`);
    const chatters = Object.keys(s.chatters).length;
    lines.push(`- Сообщений в чате: ${num(s.messages)} (из них команд: ${num(s.commands)}), писали ${num(chatters)} ${plural(chatters, ['зритель', 'зрителя', 'зрителей'])}`);
    lines.push(`- Новых фолловеров: ${num(s.follows.length)}, подписок: ${num(s.subs)}${s.gifted ? ` (подарено ${num(s.gifted)})` : ''}, рейдов: ${num(s.raids.length)}${s.bits ? `, битов: ${num(s.bits)}` : ''}`);

    const top = Object.entries(s.chatters).sort((a, b) => b[1] - a[1]).slice(0, TOP_CHATTERS);
    if (top.length) {
        lines.push('', '## Самые активные в чате', '');
        top.forEach(([user, count], i) => lines.push(`${i + 1}. ${user} — ${num(count)}`));
    }

    const rewards = Object.entries(s.rewards).sort((a, b) => b[1].points - a[1].points);
    if (rewards.length) {
        const totalCount = rewards.reduce((n, [, r]) => n + r.count, 0);
        const totalPoints = rewards.reduce((n, [, r]) => n + r.points, 0);
        lines.push('', '## Награды за баллы', '', '| Награда | Раз | Баллов |', '|---|---|---|');
        for (const [title, r] of rewards) lines.push(`| ${title} | ${num(r.count)} | ${num(r.points)} |`);
        lines.push(`| **Всего** | **${num(totalCount)}** | **${num(totalPoints)}** |`);
        if (s.refunds) lines.push('', `Баллы вернули ${num(s.refunds)} ${plural(s.refunds, ['раз', 'раза', 'раз'])} (${num(s.refundedPoints)} ${plural(s.refundedPoints, ['балл', 'балла', 'баллов'])}).`);
    }

    if (s.follows.length) lines.push('', '## Новые фолловеры', '', s.follows.join(', '));
    if (s.raids.length) {
        lines.push('', '## Рейды', '');
        for (const r of s.raids) lines.push(`- ${r.user} — ${num(r.viewers)} ${plural(r.viewers, ['зритель', 'зрителя', 'зрителей'])}`);
    }
    return lines.join('\n') + '\n';
}

// Коротко — для логов
function short() {
    const points = Object.values(s.rewards).reduce((n, r) => n + r.points, 0);
    const count = Object.values(s.rewards).reduce((n, r) => n + r.count, 0);
    return `${duration(Date.now() - s.startedAt)}, сообщений ${num(s.messages)}, писали ${num(Object.keys(s.chatters).length)}, ` +
        `наград ${num(count)} (${num(points)} баллов), фолловеров +${num(s.follows.length)}, подписок ${num(s.subs)}, рейдов ${num(s.raids.length)}`;
}

// Сохранить итоги в файл; возвращает путь к файлу
function save() {
    const start = new Date(s.startedAt);
    const name = `${start.getFullYear()}-${two(start.getMonth() + 1)}-${two(start.getDate())}_${two(start.getHours())}-${two(start.getMinutes())}.md`;
    fs.mkdirSync(DIR, { recursive: true });
    const file = path.join(DIR, name);
    fs.writeFileSync(file, text());
    return file;
}

module.exports = {
    streamStarted, streamEnded, saveSnapshot, save, text, short,
    viewers, game, message, command, reward, refund, follow, sub, raid, cheer,
    get current() { return s; }
};
