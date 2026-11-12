// Награды за баллы канала, которые бот создаёт, показывает и скрывает сам (Twitch Helix API).
// Сами награды (название, цена, для какой игры) описаны в REWARDS в начале src/index.js.
// Twitch даёт боту менять и удалять только награды, созданные им самим (тем же Client ID),
// поэтому награды, созданные вручную в панели автора, бот не трогает.
const axios = require('axios');
const state = require('../state');

const HELIX_REWARDS = 'https://api.twitch.tv/helix/channel_points/custom_rewards';

let broadcasterId = null;
let queue = Promise.resolve(); // синхронизации идут строго по очереди, даже если категорию сменили дважды подряд

const auth = () => ({
    'Client-ID': process.env.CLIEN,
    'Authorization': `Bearer ${process.env.OAUTH}`
});

const errText = (err) => (err.response && err.response.data && err.response.data.message) || err.message;

// id канала + проверка, что у токена есть право управлять наградами
async function getBroadcasterId() {
    if (broadcasterId) return broadcasterId;
    const { data } = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${process.env.OAUTH}` },
        timeout: 10000
    });
    if (!data.scopes.includes('channel:manage:redemptions')) {
        throw new Error('у токена нет права channel:manage:redemptions — получите токен заново: npm run setup');
    }
    broadcasterId = data.user_id;
    return broadcasterId;
}

function rewardBody(def) {
    return {
        title: def.title,
        cost: def.cost,
        prompt: def.prompt || '',
        is_enabled: true,
        is_user_input_required: !!def.is_user_input_required,
        is_global_cooldown_enabled: !!def.global_cooldown_seconds,
        ...(def.global_cooldown_seconds ? { global_cooldown_seconds: def.global_cooldown_seconds } : {}),
        should_redemptions_skip_request_queue: false // погашения остаются в очереди — баллы можно вернуть вручную
    };
}

// отличается ли награда на Twitch от описания в REWARDS (цена, описание, кулдаун...)
function differs(def, r) {
    const b = rewardBody(def);
    const cd = r.global_cooldown_setting || {};
    return r.cost !== b.cost
        || (r.prompt || '') !== b.prompt
        || r.is_user_input_required !== b.is_user_input_required
        || cd.is_enabled !== b.is_global_cooldown_enabled
        || (b.is_global_cooldown_enabled && cd.global_cooldown_seconds !== b.global_cooldown_seconds)
        || r.should_redemptions_skip_request_queue !== b.should_redemptions_skip_request_queue;
}

async function doSync(rewards, game) {
    const broadcaster_id = await getBroadcasterId();
    const { data } = await axios.get(HELIX_REWARDS, {
        headers: auth(),
        params: { broadcaster_id, only_manageable_rewards: true }, // только награды, созданные ботом
        timeout: 10000
    });
    const existing = new Map(data.data.map((r) => [r.title.toLowerCase(), r]));
    const visible = {}; // что видят зрители после синхронизации — для панели «Стрим»

    for (const def of Object.values(rewards)) {
        const current = existing.get(def.title.toLowerCase());
        const wanted = def.game === game;
        visible[def.title] = !!(current && current.is_enabled);
        try {
            if (wanted && !current) {
                await axios.post(HELIX_REWARDS, rewardBody(def), { headers: auth(), params: { broadcaster_id }, timeout: 10000 });
                visible[def.title] = true;
                console.log(`Награда создана: ${def.title}`);
            }
            else if (wanted && current && (!current.is_enabled || differs(def, current))) {
                // награда была скрыта и/или в REWARDS поменяли цену или кулдаун — показываем и обновляем
                const action = current.is_enabled ? 'Награда обновлена' : 'Награда снова показана';
                const { title, ...changes } = rewardBody(def); // в changes is_enabled: true
                await axios.patch(HELIX_REWARDS, changes, { headers: auth(), params: { broadcaster_id, id: current.id }, timeout: 10000 });
                visible[def.title] = true;
                console.log(`${action}: ${def.title}`);
            }
            else if (!wanted && current && current.is_enabled) {
                // не удаляем, а скрываем: при удалении Twitch засчитал бы всю очередь как выполненную
                await axios.patch(HELIX_REWARDS, { is_enabled: false }, { headers: auth(), params: { broadcaster_id, id: current.id }, timeout: 10000 });
                visible[def.title] = false;
                console.log(`Награда скрыта: ${def.title}`);
            }
        } catch (err) {
            const text = errText(err);
            if (text.includes('DUPLICATE'))
                console.warn(`Награда «${def.title}» уже есть на канале, но создана вручную. Удалите её в панели автора — тогда бот будет создавать и убирать её сам`);
            else
                console.error(`Награда «${def.title}»: ${text}`);
        }
    }
    state.rewards = Object.values(rewards).map((def) => ({ title: def.title, cost: def.cost, visible: visible[def.title] }));
}

// rewards — REWARDS из index.js, game — 'ddnet' | 'dota' | null (оффлайн или другая игра).
// Создаёт или показывает награды этой игры и скрывает награды бота для остальных игр.
// Возвращает false, если до Twitch не достучались вообще — тогда стоит попробовать позже.
function syncRewards(rewards, game) {
    const run = queue.then(() => doSync(rewards, game)).then(
        () => true,
        (err) => {
            console.error(`Награды: не удалось синхронизировать — ${errText(err)}`);
            return false;
        }
    );
    queue = run;
    return run;
}

// Решение по погашению из очереди: 'CANCELED' — баллы возвращаются зрителю, 'FULFILLED' — выполнено, баллы остаются.
// Работает только для наград, созданных ботом, и пока погашение ещё в очереди.
async function setRedemptionStatus(rewardId, redemptionId, status) {
    const broadcaster_id = await getBroadcasterId();
    await axios.patch(`${HELIX_REWARDS}/redemptions`, { status }, {
        headers: auth(),
        params: { broadcaster_id, reward_id: rewardId, id: redemptionId },
        timeout: 10000
    });
}

// Вернуть зрителю баллы (отменённое погашение Twitch возвращает сам). true — получилось
async function refund(rewardId, redemptionId) {
    try {
        await setRedemptionStatus(rewardId, redemptionId, 'CANCELED');
        return true;
    } catch (err) {
        console.error(`Не удалось вернуть баллы: ${errText(err)}`);
        return false;
    }
}

// Погашения наград бота, которые ждут решения (статус UNFULFILLED), от старых к новым.
// Twitch отдаёт очередь только для наград, созданных ботом.
async function pendingRedemptions(rewards) {
    const broadcaster_id = await getBroadcasterId();
    const { data } = await axios.get(HELIX_REWARDS, {
        headers: auth(),
        params: { broadcaster_id, only_manageable_rewards: true },
        timeout: 10000
    });
    const ours = new Set(Object.values(rewards).map((def) => def.title.toLowerCase()));
    const result = [];
    for (const r of data.data.filter((x) => ours.has(x.title.toLowerCase()))) {
        const { data: page } = await axios.get(`${HELIX_REWARDS}/redemptions`, {
            headers: auth(),
            params: { broadcaster_id, reward_id: r.id, status: 'UNFULFILLED', sort: 'OLDEST', first: 50 },
            timeout: 10000
        });
        for (const x of page.data) {
            result.push({
                id: x.id, rewardId: r.id, reward: r.title, cost: r.cost,
                user: x.user_name || x.user_login, text: x.user_input || '', time: new Date(x.redeemed_at).getTime()
            });
        }
    }
    return result.sort((a, b) => a.time - b.time);
}

module.exports = { syncRewards, refund, setRedemptionStatus, pendingRedemptions, errText };
