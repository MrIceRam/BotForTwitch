// Низкоуровневое рисование в терминале: отдельный экран (как у полноэкранных программ),
// цвета и перерисовка только изменившихся строк, чтобы ничего не мигало.
const { width, truncate, display } = require('./text');

// Цвета и стили — коды ANSI. Используются как второй элемент сегмента: ['текст', STYLE.red]
const STYLE = {
    normal: '',
    bold: '1',
    dim: '2',
    red: '31',
    green: '32',
    yellow: '33',
    blue: '34',
    magenta: '35',
    cyan: '36',
    gray: '90',
    title: '1;36',
    key: '1;33',
    inverse: '7'
};

const BORDER = STYLE.gray;

// Строка из цветных кусков: [['текст', стиль], ...] → готовая строка ровно w клеток шириной
function paint(segments, w) {
    let out = '';
    let used = 0;
    for (const [text, style = ''] of segments) {
        if (used >= w) break;
        let t = display(text); // составные эмодзи — в упрощённом виде, чтобы не съезжали рамки
        if (used + width(t) > w) t = truncate(t, w - used);
        if (!t) continue;
        out += style ? `\x1b[${style}m${t}\x1b[0m` : t;
        used += width(t);
    }
    return out + ' '.repeat(Math.max(0, w - used));
}

// Панель с рамкой: title — заголовок в рамке, lines — строки содержимого (каждая — массив сегментов)
function box(title, lines, w, h, titleStyle = STYLE.title) {
    const inner = w - 2;
    const head = title ? ` ${truncate(title, Math.max(0, inner - 3))} ` : '';
    const rows = [
        `\x1b[${BORDER}m┌─\x1b[0m` + (head ? `\x1b[${titleStyle}m${head}\x1b[0m` : '') +
        `\x1b[${BORDER}m${'─'.repeat(Math.max(0, inner - 1 - width(head)))}┐\x1b[0m`
    ];
    for (let i = 0; i < h - 2; i++) {
        const line = lines[i] || [];
        rows.push(`\x1b[${BORDER}m│\x1b[0m` + paint(line, inner) + `\x1b[${BORDER}m│\x1b[0m`);
    }
    rows.push(`\x1b[${BORDER}m└${'─'.repeat(Math.max(0, inner))}┘\x1b[0m`);
    return rows;
}

class Screen {
    constructor(output = process.stdout) {
        this.out = output;
        this.prev = [];
        this.active = false;
    }

    // Размер окна. Последний столбец не используем: некоторые консоли Windows переносят строку,
    // если написать символ в самую последнюю клетку.
    get size() {
        return { cols: Math.max(20, (this.out.columns || 100) - 1), rows: Math.max(10, this.out.rows || 30) };
    }

    start() {
        this.active = true;
        this.out.write('\x1b[?1049h\x1b[?25l\x1b[2J'); // отдельный экран, спрятать курсор, очистить
        this.prev = [];
    }

    stop() {
        if (!this.active) return;
        this.active = false;
        this.out.write('\x1b[0m\x1b[?25h\x1b[?1049l'); // вернуть обычный экран и курсор
    }

    // Нарисовать кадр: перезаписываем только строки, которые изменились с прошлого раза
    draw(lines) {
        if (!this.active) return;
        let buf = '';
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] !== this.prev[i]) buf += `\x1b[${i + 1};1H\x1b[0m${lines[i]}\x1b[0m\x1b[K`;
        }
        this.prev = lines;
        if (buf) this.out.write(buf);
    }

    // После изменения размера окна старый кадр недействителен — рисуем всё заново
    invalidate() {
        this.prev = [];
        if (this.active) this.out.write('\x1b[2J');
    }
}

module.exports = { Screen, STYLE, paint, box };
