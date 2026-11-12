// Запросы к Twitch API: данные стрима и канала, смена названия.
const axios = require('axios');

const HELIX = 'https://api.twitch.tv/helix';
const TIMEOUT = 10000;

const headers = () => ({
    'Client-ID': process.env.CLIEN,
    'Authorization': `Bearer ${process.env.OAUTH}`
});

// Текст ошибки: Twitch кладёт понятное описание в response.data.message
const errText = (err) => (err.response && err.response.data && err.response.data.message) || err.message;

// Проверка токена: кому он выдан (user_id), какие у него права (scopes), сколько ему осталось (expires_in)
async function validate() {
    const { data } = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${process.env.OAUTH}` },
        timeout: TIMEOUT
    });
    return data;
}

let broadcasterId = null;
async function getBroadcasterId() {
    if (!broadcasterId) broadcasterId = (await validate()).user_id;
    return broadcasterId;
}

// Идущий стрим: { game_name, title, viewer_count, started_at } или null, если стрим оффлайн
async function getStream() {
    const { data } = await axios.get(`${HELIX}/streams`, {
        params: { user_login: process.env.TWITCHUSER },
        headers: headers(),
        timeout: TIMEOUT
    });
    return data.data[0] || null;
}

// Канал (есть и когда стрим оффлайн): { title, game_name, ... }
async function getChannel() {
    const { data } = await axios.get(`${HELIX}/channels`, {
        params: { broadcaster_id: await getBroadcasterId() },
        headers: headers(),
        timeout: TIMEOUT
    });
    return data.data[0] || null;
}

const TITLE_MAX = 140; // ограничение Twitch

async function setTitle(title) {
    const { scopes } = await validate();
    if (!scopes.includes('channel:manage:broadcast')) {
        throw new Error('у токена нет права менять название (channel:manage:broadcast) — запустите npm run setup и войдите заново');
    }
    try {
        await axios.patch(`${HELIX}/channels`, { title }, {
            params: { broadcaster_id: await getBroadcasterId() },
            headers: headers(),
            timeout: TIMEOUT
        });
    } catch (err) {
        throw new Error(`Twitch не принял название: ${errText(err)}`);
    }
}

module.exports = { validate, getBroadcasterId, getStream, getChannel, setTitle, errText, TITLE_MAX };
