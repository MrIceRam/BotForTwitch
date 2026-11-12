// Что показывать в панели «Стрим» (слева сверху).
// Каждая строка — row('Подпись', [['текст', STYLE.цвет], ...]). Добавляйте, убирайте и меняйте строки как угодно.
const { STYLE } = require('./screen');
const { wrap } = require('./text');

const LABEL_W = 11; // ширина колонки с подписями

const two = (n) => String(n).padStart(2, '0');

function duration(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

function minutesLeft(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
}

function streamPanel(bot, w) {
    const { state } = bot;
    const now = Date.now();
    const lines = [];
    const label = (text) => [` ${text.padEnd(LABEL_W - 1)}`, STYLE.gray];
    const row = (name, segments) => lines.push([label(name), ...segments]);
    const rowWrapped = (name, text, style, maxLines) => {
        wrap(text, w - LABEL_W).slice(0, maxLines).forEach((l, i) =>
            lines.push([i === 0 ? label(name) : [' '.repeat(LABEL_W)], [l, style]]));
    };

    // канал — в заголовке панели (см. streamTitle в src/index.js)
    if (state.live) {
        row('Статус', [['● в эфире ', STYLE.green], [state.startedAt ? duration(now - state.startedAt) : '']]);
        row('Зрители', [[String(state.viewers ?? '—')]]);
    } else {
        row('Статус', [['○ оффлайн', STYLE.gray]]);
    }

    row('Категория', [[state.game || '—'], [state.forcedGame ? '  (вручную)' : '', STYLE.yellow]]);
    rowWrapped('Название', state.title || '—', '', 2);

    row('Чат', state.chatConnected ? [['подключён', STYLE.green]] : [['нет связи', STYLE.red]]);

    if (bot.isDDNet()) {
        const ddnet = state.ddnet.ok;
        row('DDNet', ddnet === true ? [['связь есть', STYLE.green]]
            : ddnet === false ? [['нет связи — DDNet запущен?', STYLE.red]]
            : [['ещё не проверялась', STYLE.gray]]);
    }

    const ad = bot.ad.get();
    if (!ad.enabled) row('Реклама', [['выключена', STYLE.gray]]);
    else if (!bot.isDDNet()) row('Реклама', [[`каждые ${ad.intervalMinutes} мин`], [' · ждёт DDNet', STYLE.gray]]);
    else row('Реклама', [[`каждые ${ad.intervalMinutes} мин`], [ad.nextAt ? ` · через ${duration(ad.nextAt - now)}` : '']]);

    const visible = state.rewards.filter((r) => r.visible).map((r) => r.title);
    if (state.rewardsPaused) row('Награды', [['скрыты вручную', STYLE.yellow]]);
    else if (visible.length) rowWrapped('Награды', visible.join(', '), STYLE.green, 2);
    else row('Награды', [['все скрыты', STYLE.gray]]);

    const ov = bot.overlay.status();
    if (ov.error) row('Оверлей', [['не запустился: ' + ov.error, STYLE.red]]);
    else if (!ov.running) row('Оверлей', [['запускается…', STYLE.gray]]);
    else row('Оверлей', [[ov.url.replace('http://', '')], ov.clients ? [' · OBS ✓', STYLE.green] : [' · ждёт OBS', STYLE.gray]]);

    // с запуска бота: сообщений в чате, погашений наград бота, сколько раз вернули баллы
    // (без эмодзи: часть терминалов рисует их другой ширины, и рамка съезжает)
    row('Сообщения', [[String(state.stats.messages)], [` · наград ${state.stats.redemptions} · возвр. ${state.stats.refunds}`, STYLE.gray]]);
    row('Токен', [[state.tokenExpiresAt ? `ещё ${minutesLeft(state.tokenExpiresAt - now)}` : '—', STYLE.gray]]);

    return lines;
}

module.exports = { streamPanel, duration };
