// Работа с шириной текста в терминале.
// В терминале символы занимают разное число клеток: буквы — 1, эмодзи и иероглифы — 2.
// Текст режем не по символам, а по «графемам» — тому, что человек видит как один знак.
//
// Составные эмодзи (👍🏽, 👨‍👩‍👧, 🇷🇺, 1️⃣, ❤️) разные терминалы рисуют разной ширины, и из-за этого
// съезжают рамки. Поэтому в окне бота они показываются упрощённо: 👍🏽 → 👍, 👨‍👩‍👧 → 👨, 🇷🇺 → RU, 1️⃣ → 1, ❤️ → ❤.
// Это только отображение: в Twitch и DDNet текст уходит как есть.

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

const rawGraphemes = (s) => Array.from(segmenter.segment(String(s)), (x) => x.segment);

function displayGrapheme(g) {
    if (g.includes('‍')) g = g.slice(0, g.indexOf('‍'));                 // семья и т.п. → первый эмодзи
    g = g.replace(/[\u{1F3FB}-\u{1F3FF}︎️⃣\u{E0020}-\u{E007F}]/gu, ''); // оттенок кожи, варианты, флаги-теги
    return g.replace(/\p{Regional_Indicator}/gu, (c) => String.fromCharCode(c.codePointAt(0) - 0x1f1e6 + 65)); // 🇷🇺 → RU
}

// Строка в том виде, в каком её показывает окно бота
const display = (s) => rawGraphemes(s).map(displayGrapheme).join('');

const graphemes = (s) => rawGraphemes(s);

// Диапазоны «широких» символов: иероглифы, хангыль, полноширинные латинские буквы (ＭｒＩｃｅＲａｍ) и т.п.
const WIDE_RANGES = [
    [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
    [0xa000, 0xa4cf], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60],
    [0xffe0, 0xffe6], [0x20000, 0x3fffd]
];

const isWideCodePoint = (cp) => WIDE_RANGES.some(([a, b]) => cp >= a && cp <= b);

// Ширина одной графемы — уже в упрощённом виде (см. display)
function graphemeWidth(g) {
    if (!g) return 0;
    const cp = g.codePointAt(0);
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;         // управляющие символы
    if (/^\p{Mark}+$/u.test(g)) return 0;                          // одиночные комбинируемые знаки
    if (/\p{Extended_Pictographic}/u.test(g)) {
        // эмодзи-«картинки» (🔥 🎮) — 2 клетки; символы вроде ❤ ☀ без FE0F терминалы рисуют узкими
        return /\p{Emoji_Presentation}/u.test(g) ? 2 : 1;
    }
    return isWideCodePoint(cp) ? 2 : 1;
}

// Сколько клеток терминала займёт строка
function width(s) {
    let w = 0;
    for (const g of rawGraphemes(display(s))) w += graphemeWidth(g);
    return w;
}

// Обрезать строку так, чтобы она заняла не больше max клеток
function truncate(s, max, ellipsis = '…') {
    s = display(s);
    if (width(s) <= max) return s;
    const limit = Math.max(0, max - width(ellipsis));
    let out = '';
    let w = 0;
    for (const g of rawGraphemes(s)) {
        const gw = graphemeWidth(g);
        if (w + gw > limit) break;
        out += g;
        w += gw;
    }
    return max > 0 ? out + ellipsis : '';
}

// Дополнить пробелами до ширины w (или обрезать, если длиннее)
function fit(s, w) {
    const t = truncate(s, w);
    return t + ' '.repeat(Math.max(0, w - width(t)));
}

// Разбить текст на строки шириной не больше max: по словам, а слишком длинные слова — по графемам
function wrap(s, max) {
    if (max <= 0) return [];
    const lines = [];
    for (const paragraph of display(s).replace(/\t/g, '    ').split(/\r?\n/)) {
        let line = '';
        let lineW = 0;
        for (const word of paragraph.split(/(\s+)/)) {
            if (!word) continue;
            const ww = width(word);
            if (lineW + ww <= max) { line += word; lineW += ww; continue; }
            if (/^\s+$/.test(word)) { lines.push(line); line = ''; lineW = 0; continue; }
            if (line) { lines.push(line); line = ''; lineW = 0; }
            for (const g of rawGraphemes(word)) {            // слово длиннее строки — режем по графемам
                const gw = graphemeWidth(g);
                if (lineW + gw > max) { lines.push(line); line = ''; lineW = 0; }
                line += g;
                lineW += gw;
            }
        }
        lines.push(line);
    }
    return lines;
}

module.exports = { graphemes, graphemeWidth, display, width, truncate, fit, wrap };
