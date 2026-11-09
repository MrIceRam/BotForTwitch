// Автоматическое заполнение .env через twitchtokengenerator.com
// Запуск: npm run setup (или само запускается из index.js, если .env пустой)
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');

const ENV_PATH = '.env'; // как и в dotenv / tokens.js — относительно папки запуска
const API = 'https://twitchtokengenerator.com/api/v2';
const SCOPES = ['chat:read', 'chat:edit', 'channel:read:redemptions', 'channel:manage:redemptions'];
const POLL_MS = 5000;              // API просит не чаще раза в 5 секунд
const TIMEOUT_MS = 10 * 60 * 1000; // ждём авторизацию до 10 минут

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Записывает ключи в .env: существующие строки заменяет, новых добавляет
function writeEnv(values) {
    let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    for (const [key, value] of Object.entries(values)) {
        const line = `${key}=${value}`;
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, line);
        } else {
            if (content && !content.endsWith('\n')) content += '\n';
            content += line + '\n';
        }
        process.env[key] = value;
    }
    fs.writeFileSync(ENV_PATH, content);
}

function openBrowser(url) {
    exec(`start "" "${url}"`, (err) => {
        if (err) console.log('Не получилось открыть браузер, откройте ссылку вручную.');
    });
}

async function getScopeIds() {
    const { data } = await axios.get(`${API}/scopes`, { timeout: 10000 });
    const ids = data.scopes.filter((s) => SCOPES.includes(s.scope)).map((s) => s.id);
    if (ids.length !== SCOPES.length) throw new Error('Не нашёл id для всех нужных прав');
    return ids;
}

async function setup() {
    console.log('Получаю токены Twitch...');
    const scope_ids = await getScopeIds();

    const { data: wf } = await axios.post(
        `${API}/workflows`,
        { title: 'BotForTwitch', scope_ids },
        { timeout: 10000 }
    );

    console.log('\nВойдите аккаунтом канала и нажмите "Authorize":');
    console.log(wf.authorization_url + '\n');
    openBrowser(wf.authorization_url);

    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
        await sleep(POLL_MS);
        const res = await axios.get(`${API}/workflows/${wf.id}`, {
            headers: { Authorization: `Bearer ${wf.retrieval_key}` },
            timeout: 10000,
        });
        if (res.status === 200 && res.data.status === 'authorized') {
            const d = res.data;
            writeEnv({
                TWITCHUSER: d.username,
                OAUTH: d.access_token,
                CLIEN: d.client_id,
                REFRESH: d.refresh_token,
            });
            console.log(`Готово! .env заполнен для канала ${d.username}`);
            return true;
        }
        process.stdout.write('.');
    }
    throw new Error('Не дождался авторизации (10 минут). Запустите ещё раз.');
}

module.exports = { setup, writeEnv };

if (require.main === module) {
    setup().catch((err) => {
        console.error('Ошибка настройки:', err.message);
        process.exit(1);
    });
}
