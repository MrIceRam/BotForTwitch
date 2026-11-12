// Интерфейс бота в терминале.
//
//   ┌ Стрим ────────────┐┌ Чат Twitch ──────────┐┌ Логи ───────────────┐
//   │ статистика стрима ││ что пишут зрители    ││ всё, что делает бот │
//   ├ Инструменты ──────┤│                      │├ Ошибки ─────────────┤
//   │ 1 …  2 …  0 Выход ││                      ││ только ошибки       │
//   └───────────────────┘└──────────────────────┘└─────────────────────┘
//    подсказка по клавишам
//
// Если окно уже CHAT_MIN_COLS столбцов, чат не помещается и прячется (остаются две колонки).
// Что показывать в панели «Стрим» — src/ui/stream-panel.js
// Какие есть инструменты — src/ui/menu.js
// Этот файл — «движок»: раскладка, клавиши, меню, поле ввода, прокрутка чата и логов.
const readline = require('readline');
const { Screen, STYLE, paint, box } = require('./screen');
const { width, wrap, graphemes, display } = require('./text');
const log = require('./log');
const chat = require('./chat');

// Быстрые эмодзи в поле ввода: Tab, затем цифра (1–9, 0)
const EMOJI = ['🔥', '😂', '❤️', '👍', '🎮', '🏆', '💀', '😎', '✨', '🎉'];
const MESSAGE_MS = 6000;   // сколько секунд держать сообщение «✓ Готово» под меню
const MIN_COLS = 60;
const MIN_ROWS = 16;
const CHAT_MIN_COLS = 100; // уже — чат не показываем

const two = (n) => String(n).padStart(2, '0');
const clock = (d) => `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
const resolve = (v) => (typeof v === 'function' ? v() : v);
const charCount = (s) => [...s].length;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ---------- чат: цвет ника и строки сообщения ----------
const NICK_COLORS = ['91', '92', '93', '94', '95', '96'];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);

// Ник цветом, который зритель выбрал на Twitch (#RRGGBB). Слишком тёмные цвета осветляем —
// на чёрном фоне терминала их не прочитать. Нет цвета — берём постоянный цвет по нику.
function nickStyle(entry) {
    const m = /^#?([0-9a-f]{6})$/i.exec(entry.color || '');
    if (!m) return `1;${NICK_COLORS[hash(entry.user) % NICK_COLORS.length]}`;
    let rgb = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    const light = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    if (light < 0.3) rgb = rgb.map((c) => Math.round(c + (255 - c) * 0.45));
    return `1;38;2;${rgb.join(';')}`;
}

// Одно сообщение чата → строки панели шириной w
function chatLines(e, w) {
    const time = `${two(e.time.getHours())}:${two(e.time.getMinutes())} `;
    let head;
    let body;
    let headStyle;
    let bodyStyle = '';
    if (e.kind === 'reward') {
        head = `🎁 ${e.user}`;
        body = ` → «${e.reward}»${e.cost ? ` (${e.cost})` : ''}${e.text ? `: ${e.text}` : ''}`;
        headStyle = '1;33';
        bodyStyle = STYLE.yellow;
    } else if (e.kind === 'event') { // фоллов, подписка, рейд, биты
        head = `${e.icon || '★'} ${e.user}`;
        body = ` ${e.text}`;
        headStyle = '1;35';
        bodyStyle = STYLE.magenta;
    } else {
        head = e.kind === 'bot' ? `${e.user} (бот)` : e.user;
        body = `: ${e.text}`;
        headStyle = e.kind === 'bot' ? '1;90' : nickStyle(e);
        bodyStyle = e.kind === 'command' ? STYLE.cyan : e.kind === 'bot' ? STYLE.gray : '';
    }
    const shownHead = display(head);
    return wrap(head + body, Math.max(10, w - time.length)).map((line, i) => {
        const prefix = [i === 0 ? time : ' '.repeat(time.length), STYLE.gray];
        if (i === 0 && line.startsWith(shownHead)) return [prefix, [shownHead, headStyle], [line.slice(shownHead.length), bodyStyle]];
        return [prefix, [line, bodyStyle]];
    });
}

// Одна запись лога → строки панели шириной w
function logLines(e, w) {
    const style = e.level === 'error' ? STYLE.red : e.level === 'warn' ? STYLE.yellow : '';
    return wrap(e.text, Math.max(10, w - 9))
        .map((t, j) => [[j === 0 ? `${clock(e.time)} ` : ' '.repeat(9), STYLE.gray], [t, style]]);
}

// Последние h строк списка (с прокруткой на scroll строк вверх); toLines(item) → строки или null — пропустить
function scrollView(list, toLines, h, scroll) {
    const blocks = [];
    let count = 0;
    for (let i = list.length - 1; i >= 0 && count < h + scroll; i--) {
        const block = toLines(list[i]);
        if (!block) continue;
        blocks.push(block);
        count += block.length;
    }
    const lines = blocks.reverse().flat();
    const s = Math.min(scroll, Math.max(0, lines.length - h));
    const end = lines.length - s;
    return { lines: lines.slice(Math.max(0, end - h), end), scroll: s };
}

function startUI({ streamPanel, streamTitle, menu, onExit, input = process.stdin, output = process.stdout }) {
    const screen = new Screen(output);
    const ui = {
        stack: [{ title: 'Инструменты', items: menu }], // открытые меню: последнее — текущее
        field: null,      // открытое поле ввода
        palette: false,   // показана палитра эмодзи
        message: null,    // { text, style, until } — результат последнего действия
        busy: false,      // идёт действие — новые не запускаем
        scroll: 0,        // на сколько строк логи прокручены вверх
        chatScroll: 0     // на сколько строк чат прокручен вверх
    };
    const EXIT_MENU = { title: 'Выход', items: [{ label: 'Да — скрыть награды и выйти', action: () => onExit() }] };
    let stopped = false;
    let queued = false;
    let logPage = 10;
    let chatPage = 10;
    let logWidth = 60;    // ширина панелей с прошлого кадра — чтобы при прокрутке новые строки не сдвигали то, что читаешь
    let chatWidth = 0;

    // ---------- действия ----------
    function setMessage(text, style) {
        ui.message = text ? { text, style, until: Date.now() + MESSAGE_MS } : null;
    }

    // goBack — после успешного действия вернуться в меню уровнем выше
    async function run(fn, goBack = false) {
        if (ui.busy) return;
        ui.busy = true;
        setMessage('выполняю…', STYLE.yellow);
        render();
        try {
            const result = await fn();
            if (goBack && ui.stack.length > 1) ui.stack.pop();
            setMessage(`✓ ${result || 'Готово'}`, STYLE.green);
        } catch (err) {
            setMessage(`✗ ${err.message}`, STYLE.red);
            console.error(err.message);
        } finally {
            ui.busy = false;
            render();
        }
    }

    // ---------- меню ----------
    const current = () => ui.stack[ui.stack.length - 1];
    const items = () => (resolve(current().items) || []).slice(0, 9); // цифр всего 9

    function choose(item) {
        if (item.items) {
            ui.stack.push({ title: resolve(item.title) || resolve(item.label), items: item.items });
            setMessage(null);
            if (item.onOpen) run(item.onOpen); // например, загрузить очередь наград
        } else if (item.input) {
            openField(item);
        } else if (item.action) {
            run(item.action, item.back);
        }
    }

    function back() {
        setMessage(null);
        if (ui.stack.length > 1) ui.stack.pop();
        else ui.stack.push(EXIT_MENU); // в главном меню 0 — выход (с подтверждением)
    }

    function menuKey(str, key) {
        if (ui.busy) return;
        if (str && str >= '1' && str <= '9') {
            const item = items()[Number(str) - 1];
            if (item) choose(item);
        } else if (str === '0' || key.name === 'backspace') {
            back();
        } else if (key.name === 'escape' && ui.stack.length > 1) {
            back();
        }
    }

    // ---------- поле ввода ----------
    function openField(item) {
        const f = item.input;
        const value = String(resolve(f.initial) ?? '');
        ui.field = {
            title: resolve(item.title) || resolve(item.label),
            prompt: resolve(f.prompt) || '',
            value,
            cursor: value.length,
            maxLength: f.maxLength || 500,
            emoji: !!f.emoji,
            onSubmit: f.onSubmit,
            error: ''
        };
        ui.palette = false;
        setMessage(null);
    }

    async function submitField() {
        const f = ui.field;
        if (ui.busy) return;
        ui.busy = true;
        f.error = '';
        setMessage('сохраняю…', STYLE.yellow);
        render();
        try {
            const result = await f.onSubmit(f.value);
            ui.field = null;
            setMessage(`✓ ${result || 'Сохранено'}`, STYLE.green);
        } catch (err) {
            f.error = err.message; // поле остаётся открытым — можно исправить
            setMessage(null);
        } finally {
            ui.busy = false;
            render();
        }
    }

    function insert(text) {
        const f = ui.field;
        text = text.replace(/[\r\n\t]/g, ' ');
        if (charCount(f.value) + charCount(text) > f.maxLength) {
            f.error = `Не больше ${f.maxLength} символов`;
            return;
        }
        f.value = f.value.slice(0, f.cursor) + text + f.value.slice(f.cursor);
        f.cursor += text.length;
        f.error = '';
    }

    // курсор двигается по графемам, чтобы не разрезать эмодзи пополам
    const prevStop = (f) => { const g = graphemes(f.value.slice(0, f.cursor)); return f.cursor - (g.length ? g[g.length - 1].length : 0); };
    const nextStop = (f) => { const g = graphemes(f.value.slice(f.cursor)); return f.cursor + (g.length ? g[0].length : 0); };

    function fieldKey(str, key) {
        const f = ui.field;
        if (ui.busy) return;
        if (ui.palette) {
            if (str && /^[0-9]$/.test(str)) { insert(EMOJI[(Number(str) + 9) % 10]); ui.palette = false; return; }
            ui.palette = false;
            if (key.name === 'escape' || key.name === 'tab') return;
        }
        switch (key.name) {
            case 'return':
            case 'enter': submitField(); return;
            case 'escape': ui.field = null; setMessage('Отменено', STYLE.gray); return;
            case 'tab': if (f.emoji) ui.palette = true; return;
            case 'backspace': { const p = prevStop(f); f.value = f.value.slice(0, p) + f.value.slice(f.cursor); f.cursor = p; f.error = ''; return; }
            case 'delete': { const n = nextStop(f); f.value = f.value.slice(0, f.cursor) + f.value.slice(n); f.error = ''; return; }
            case 'left': f.cursor = prevStop(f); return;
            case 'right': f.cursor = nextStop(f); return;
            case 'home': f.cursor = 0; return;
            case 'end': f.cursor = f.value.length; return;
        }
        if (str && !key.ctrl && !key.meta && !/^[\x00-\x1f\x7f]/.test(str)) insert(str);
    }

    // ---------- клавиши ----------
    function onKey(str, key = {}) {
        if (stopped) return;
        if (key.ctrl && key.name === 'c') { onExit(); return; }
        if (key.name === 'pageup') ui.scroll += Math.max(1, logPage - 1);
        else if (key.name === 'pagedown') ui.scroll = Math.max(0, ui.scroll - Math.max(1, logPage - 1));
        else if (key.name === 'up') ui.chatScroll += Math.max(1, chatPage - 1);
        else if (key.name === 'down') ui.chatScroll = Math.max(0, ui.chatScroll - Math.max(1, chatPage - 1));
        else if (ui.field) fieldKey(str, key);
        else menuKey(str, key);
        render();
    }

    // ---------- рисование ----------
    function fieldLines(f, w) {
        const gs = graphemes(f.value);
        let at = gs.length; // номер графемы под курсором
        for (let i = 0, pos = 0; i < gs.length; pos += gs[i].length, i++) {
            if (pos >= f.cursor) { at = i; break; }
        }
        const lines = [];
        let line = [];
        let lineW = 0;
        const put = (text, style) => {
            const gw = Math.max(1, width(text));
            if (lineW + gw > w) { lines.push(line); line = []; lineW = 0; }
            line.push([text, style]);
            lineW += gw;
        };
        gs.forEach((g, i) => put(display(g) || ' ', i === at ? STYLE.inverse : STYLE.bold));
        if (at === gs.length) put(' ', STYLE.inverse);
        lines.push(line);
        return lines;
    }

    function toolsContent(w) {
        const out = [];
        const text = (t, style) => { for (const l of wrap(t, w - 1)) out.push([[' ' + l, style]]); };
        if (ui.field) {
            const f = ui.field;
            text(f.prompt, STYLE.gray);
            out.push([]);
            for (const l of fieldLines(f, w - 2)) out.push([[' '], ...l]);
            out.push([[` ${charCount(f.value)}/${f.maxLength}`, STYLE.gray]]);
            if (f.error) text(`✗ ${f.error}`, STYLE.red);
            if (ui.palette) {
                out.push([[' Эмодзи: нажмите цифру', STYLE.gray]]);
                for (const part of [EMOJI.slice(0, 5), EMOJI.slice(5)]) {
                    out.push(part.flatMap((e) => {
                        const n = (EMOJI.indexOf(e) + 1) % 10;
                        return [[` ${n} `, STYLE.key], [e]];
                    }));
                }
            }
            out.push([]);
            out.push([[' Enter', STYLE.key], [' сохранить  ', STYLE.dim], ['Esc', STYLE.key], [' отмена', STYLE.dim]]);
            if (f.emoji) out.push([[' Tab', STYLE.key], [' быстрые эмодзи  ', STYLE.dim], ['Win+.', STYLE.key], [' все', STYLE.dim]]);
        } else {
            items().forEach((item, i) => out.push([[` ${i + 1} `, STYLE.key], [String(resolve(item.label)) + (item.items ? ' ›' : '')]]));
            out.push([]);
            out.push([[' 0 ', STYLE.key], [ui.stack.length > 1 ? 'Назад' : 'Выход', STYLE.dim]]);
        }
        if (ui.message) {
            out.push([]);
            text(ui.message.text, ui.message.style);
        }
        return out;
    }

    function statusBar(cols, withChat) {
        const hints = ui.field
            ? [['Enter', 'сохранить'], ['Esc', 'отмена']]
            : [['1–9', 'выбрать'], ['0', 'назад / выход']];
        if (withChat) hints.push(['↑/↓', 'чат']);
        hints.push(['PgUp/PgDn', 'логи'], ['Ctrl+C', 'выход']);
        const segments = hints.flatMap(([k, t]) => [[` ${k} `, STYLE.key], [`${t} `, STYLE.dim]]);
        if (!withChat) segments.push(['  чат не помещается — растяните окно', STYLE.yellow]);
        return paint(segments, cols);
    }

    function frame() {
        const { cols, rows } = screen.size;
        if (cols < MIN_COLS || rows < MIN_ROWS) {
            return Array.from({ length: rows }, (_, i) =>
                paint(i === 0 ? [[`Окно слишком маленькое — растяните его (нужно хотя бы ${MIN_COLS}×${MIN_ROWS})`, STYLE.yellow]] : [], cols));
        }
        if (ui.message && !ui.busy && Date.now() > ui.message.until) ui.message = null;

        // ширина колонок: слева стрим и инструменты, по центру чат, справа логи и ошибки
        const withChat = cols >= CHAT_MIN_COLS;
        const leftW = withChat ? clamp(Math.floor(cols * 0.32), 34, 50) : clamp(Math.floor(cols * 0.42), 36, 60);
        const rightW = withChat ? clamp(Math.floor(cols * 0.3), 30, 64) : cols - leftW;
        const chatW = withChat ? cols - leftW - rightW : 0;
        const bodyH = rows - 1; // последняя строка — подсказка по клавишам

        let streamLines;
        try { streamLines = streamPanel(leftW - 2); } catch (err) { streamLines = [[[` ошибка панели: ${err.message}`, STYLE.red]]]; }
        // инструментам — столько строк, сколько нужно (если тесно — без пустых строк), «Стрим» — остальное
        const MIN_STREAM = 8;
        let toolsLines = toolsContent(leftW - 2);
        if (toolsLines.length + 2 + MIN_STREAM > bodyH) toolsLines = toolsLines.filter((line) => line.length);
        const toolsNeeded = Math.min(toolsLines.length + 2, bodyH - MIN_STREAM);
        const streamH = Math.max(MIN_STREAM, Math.min(streamLines.length + 2, bodyH - toolsNeeded));
        const toolsH = bodyH - streamH;
        const toolsTitle = ui.field ? ui.field.title : resolve(current().title);

        const logsH = Math.max(6, Math.round(bodyH * 0.68));
        const errorsH = bodyH - logsH;
        logPage = logsH - 2;
        logWidth = rightW - 2;
        const logs = scrollView(log.entries, (e) => logLines(e, logWidth), logsH - 2, ui.scroll);
        ui.scroll = logs.scroll;
        const errors = scrollView(log.entries, (e) => (e.level !== 'info' ? logLines(e, logWidth) : null), errorsH - 2, 0);
        const errorCount = log.entries.reduce((n, e) => n + (e.level !== 'info'), 0);

        const left = [
            ...box(resolve(streamTitle) || 'Стрим', streamLines, leftW, streamH),
            ...box(toolsTitle, toolsLines, leftW, toolsH)
        ];
        const right = [
            ...box(ui.scroll ? `Логи — прокручено, PgDn вниз` : 'Логи', logs.lines, rightW, logsH),
            ...box(errorCount ? `Ошибки и предупреждения (${errorCount})` : 'Ошибки', errors.lines, rightW, errorsH,
                errorCount ? '1;31' : STYLE.title)
        ];
        let center = [];
        if (withChat) {
            chatPage = bodyH - 2;
            chatWidth = chatW - 2;
            const view = scrollView(chat.entries, (e) => chatLines(e, chatWidth), bodyH - 2, ui.chatScroll);
            ui.chatScroll = view.scroll;
            const content = view.lines.length ? view.lines : [[[' Здесь появятся сообщения из чата Twitch', STYLE.gray]]];
            center = box(ui.chatScroll ? 'Чат Twitch — прокручено, ↓ вниз' : 'Чат Twitch', content, chatW, bodyH);
        }
        const lines = left.map((l, i) => l + (center[i] || '') + right[i]);
        lines.push(statusBar(cols, withChat));
        return lines;
    }

    function draw() {
        if (stopped) return;
        screen.draw(frame());
    }

    // перерисовка не чаще одного раза за проход цикла событий
    function render() {
        if (stopped || queued) return;
        queued = true;
        setImmediate(() => { queued = false; draw(); });
    }

    const onResize = () => { screen.invalidate(); draw(); };

    // ---------- запуск и остановка ----------
    readline.emitKeypressEvents(input);
    if (input.isTTY && input.setRawMode) input.setRawMode(true);
    input.on('keypress', onKey);
    if (input.resume) input.resume();
    log.setPassthrough(false);
    // если панель прокручена вверх — сдвигаем прокрутку на новые строки, чтобы текст не уезжал, пока его читаешь
    const unsubscribeLog = log.onEntry((e) => {
        if (ui.scroll > 0) ui.scroll += logLines(e, logWidth).length;
        render();
    });
    const unsubscribeChat = chat.onEntry((e) => {
        if (ui.chatScroll > 0 && chatWidth) ui.chatScroll += chatLines(e, chatWidth).length;
        render();
    });
    const timer = setInterval(render, 1000); // часы, таймеры рекламы и токена
    if (output.on) output.on('resize', onResize);
    screen.start();
    draw();

    function stop() {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        unsubscribeLog();
        unsubscribeChat();
        input.removeListener('keypress', onKey);
        if (input.isTTY && input.setRawMode) input.setRawMode(false);
        if (input.pause) input.pause();
        if (output.removeListener) output.removeListener('resize', onResize);
        screen.stop();
        log.setPassthrough(true);
    }

    return {
        stop,
        render,
        message: (text, style = STYLE.green) => { setMessage(text, style); render(); },
        // для автотестов
        _frame: frame,
        _key: onKey,
        _state: ui
    };
}

module.exports = { startUI, EMOJI };
