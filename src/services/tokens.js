const fs = require('fs');
const axios = require('axios');
const state = require('../state');

function updateEnvValue(key, newValue) {
    try {
        // Читаем текущее содержимое .env файла
        let envContent = fs.readFileSync('.env', 'utf8');

        // Создаем регулярное выражение для поиска строки с ключом
        const regex = new RegExp(`^${key}=.*$`, 'm');

        // Заменяем значение
        const newEnvContent = envContent.replace(regex, `${key}=${newValue}`);

        // Записываем обновленное содержимое обратно в файл
        fs.writeFileSync('.env', newEnvContent);

        // Обновляем переменные окружения в текущем процессе
        process.env[key] = newValue;

        console.log(`Updated ${key} in .env file`);
    } catch (error) {
        console.error(`Error updating .env file: ${error.message}`);
    }
}

async function refreshAllTokens() {
    try {
        let twitchchannelToken;

        if(process.env.REFRESH) {
            let refrashtoken = process.env.REFRESH;
            twitchchannelToken = await refrashtokens(refrashtoken);
        }
        if(process.env.REFRESH && twitchchannelToken) {
            await updateEnvValue('OAUTH', twitchchannelToken);
        }

        return true;
    } catch (error) {
        console.log('Error refreshing tokens. USE OLD TOKENS')
        return true;
    }
}

async function refrashtokens(refrashtoken) {
    try {
        const url = `https://twitchtokengenerator.com/api/refresh/${refrashtoken}`;
        // Опция timeout задаётся в миллисекундах (10000 = 10 секунд)
        const response = await axios.get(url, { timeout: 10000 });
        if(refrashtoken === process.env.REFRESH){
            // если Twitch выдал новый refresh token — сохраняем, иначе следующее обновление может не сработать
            if (response.data.refresh && response.data.refresh !== process.env.REFRESH) {
                updateEnvValue('REFRESH', response.data.refresh);
            }
            return response.data.token
        }
    } catch (error) {
        // Если ошибка связана с таймаутом или другим исключением, выводим сообщение и продолжаем
        console.error('Запрос к API не выполнен или превысил 10 секунд:', error.message);
        throw error; // Re-throw the error to handle it in the calling function
    }
}

// ---------- Обновление токена во время работы ----------
// Токен Twitch живёт несколько часов, а стрим может идти дольше.
// Раз в 15 минут спрашиваем у Twitch, сколько токену осталось, и обновляем его заранее.
const CHECK_MS = 15 * 60 * 1000;
const REFRESH_BEFORE_S = 30 * 60; // обновляем, если осталось меньше 30 минут

let refreshing = null; // чтобы два обновления не шли одновременно

// Спросить у Twitch, сколько осталось токену, и запомнить это для панели «Стрим»
async function validateToken() {
    const { data } = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${process.env.OAUTH}` },
        timeout: 10000
    });
    state.tokenExpiresAt = data.expires_in ? Date.now() + data.expires_in * 1000 : null;
    return data;
}

async function checkAndRefresh() {
    try {
        const data = await validateToken();
        if (!data.expires_in || data.expires_in > REFRESH_BEFORE_S) return; // 0 — бессрочный токен
        console.log(`Токен Twitch истекает через ${Math.round(data.expires_in / 60)} мин — обновляю`);
    } catch (err) {
        if (!(err.response && err.response.status === 401)) {
            console.error('Не удалось проверить токен Twitch:', err.message); // сеть — попробуем в следующий раз
            return;
        }
        console.warn('Токен Twitch истёк — обновляю');
    }
    await refreshAllTokens(); // при успехе пишет "Updated OAUTH in .env file"
    await validateToken().catch(() => {});
}

// Обновить токен прямо сейчас, даже если он ещё не истекает (инструмент «Обновить токен»)
async function refreshNow() {
    const old = process.env.OAUTH;
    await refreshAllTokens();
    await validateToken().catch(() => {});
    if (process.env.OAUTH === old) throw new Error('Не удалось обновить токен — подробности в логах');
    return 'Токен обновлён';
}

// Проверить токен прямо сейчас (например, когда Twitch ответил 401) и обновить, если нужно
function keepTokenFresh() {
    if (!refreshing) refreshing = checkAndRefresh().finally(() => { refreshing = null; });
    return refreshing;
}

// comfy.js запоминает токен один раз при ComfyJS.Init. Чтобы после обновления токена
// чат и награды смогли переподключиться (например, после сбоя сети), подсовываем им актуальный токен:
//  - чат (tmi.js) умеет брать пароль из функции;
//  - награды (EventSub) ходят в Twitch через fetch со старым токеном — подменяем его на свежий.
function useFreshTokenForComfy(ComfyJS) {
    const client = ComfyJS.GetClient();
    if (client && client.opts && client.opts.identity) {
        client.opts.identity.password = () => process.env.OAUTH;
    }
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => {
        const auth = init && init.headers && init.headers.Authorization;
        if (auth && /^https:\/\/(api|id)\.twitch\.tv\//.test(String(url))) {
            const type = auth.split(' ')[0]; // "OAuth" или "Bearer"
            init = { ...init, headers: { ...init.headers, Authorization: `${type} ${process.env.OAUTH}` } };
        }
        return realFetch(url, init);
    };
}

function startTokenRefresh(ComfyJS) {
    useFreshTokenForComfy(ComfyJS);
    setInterval(keepTokenFresh, CHECK_MS);
}

module.exports = { updateEnvValue, refreshAllTokens, refrashtokens, keepTokenFresh, startTokenRefresh, refreshNow };