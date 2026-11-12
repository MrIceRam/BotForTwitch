const Bounty = require('./commands/bounty.js');
require('dotenv').config();
const log = require('./ui/log');
log.capture(); // всё, что бот пишет в консоль, попадает в журнал — и в панели «Логи» и «Ошибки» интерфейса
const chat = require('./ui/chat'); // сообщения из чата Twitch для панели «Чат»
const state = require('./state');
const twitch = require('./services/twitch');
const ad = require('./services/ad');
const ComfyJS = require("comfy.js");
const { PythonShell } = require('python-shell');
const path = require('path');
const answer = require("./commands/answer.js");
const needed = require("./services/tokens.js");
const DDMap = require("./commands/ddmap.js");

const py = (name) => path.join(__dirname, '..', 'python', name); // путь к скрипту в папке python/
//const { use } = require('react');

// ---------- Категория стрима ----------
// От категории зависит, что бот делает с игрой:
//   DDNet  — чат в игре, реклама, !invite / !points / !map, награда «Реверс»
//   Dota 2 — награды «Сообщение в чат Доты» и «Способность в Доте», в DDNet НИЧЕГО не отправляется
//   оффлайн или другая игра — ничего из этого (всегда работают только !roll и автоответы)
// Награды бот показывает для текущей игры и скрывает, когда категория меняется (см. REWARDS ниже)
// Для проверки без стрима: строка FORCE_GAME=Dota 2 (или FORCE_GAME=DDNet) в .env или инструмент «Категория» в интерфейсе
const DDNET_CATEGORIES = ['ddnet', 'ddracenetwork', 'ddrace network']; // точное название на Twitch бот пишет в консоль
const DOTA_CATEGORIES = ['dota 2'];
const CATEGORY_CHECK_MS = 60 * 1000; // категорию можно сменить посреди стрима — проверяем раз в минуту

let currentGame = null;   // null = оффлайн или ещё не узнали
let rewardsGame;          // для какой игры сейчас показаны награды; undefined = ещё ни разу не синхронизировали
let categoryKnown = false; // категорию уже узнавали — дальше о смене можно писать в чат
state.channel = process.env.TWITCHUSER || '';
state.forcedGame = process.env.FORCE_GAME || null;

async function StreamCategory() {
    let fetched = false;
    try {
        const stream = await twitch.getStream(); // null — стрим оффлайн
        state.live = !!stream;
        state.twitchGame = stream ? stream.game_name : null;
        state.viewers = stream ? stream.viewer_count : null;
        state.startedAt = stream ? new Date(stream.started_at) : null;
        if (stream) state.title = stream.title;
        else {
            const channel = await twitch.getChannel(); // название есть и у оффлайн-канала
            if (channel) state.title = channel.title;
        }
        fetched = true;
    } catch (err) {
        // старую категорию не сбрасываем: из-за одного сбоя сети стрим не должен "становиться оффлайн"
        console.error('Не удалось получить категорию стрима:', twitch.errText(err));
        if (err.response && err.response.status === 401) await needed.keepTokenFresh(); // токен истёк — обновляем сразу
    }
    const newGame = state.forcedGame || (fetched ? state.twitchGame : currentGame);
    const changed = newGame !== currentGame;
    if (changed) console.log(`Категория стрима: ${newGame || 'оффлайн'}${state.forcedGame ? ' (выбрана вручную)' : ''}`);
    currentGame = newGame;
    state.game = newGame;

    // награды: показываем для новой игры и скрываем от старой; не получилось — повторим через минуту
    const game = state.rewardsPaused ? null : gameKey();
    if (game !== rewardsGame && await Bounty.syncRewards(REWARDS, game)) rewardsGame = game;

    // пишем в чат Twitch, что теперь доступно (не при запуске бота и не когда стрим закончился)
    if (changed && categoryKnown && newGame) ComfyJS.Say(`Теперь ${newGame}! ${helpText()}`);
    if (fetched || state.forcedGame) categoryKnown = true;
}

// Что доступно зрителям прямо сейчас — для !help и сообщения при смене категории
function helpText() {
    const commands = [...(isDDNet() ? ['!invite <ник>', '!points <ник>', '!map [ник]'] : []), '!roll', '!help'];
    const rewards = state.rewardsPaused ? [] : Object.values(REWARDS)
        .filter((r) => r.game === gameKey())
        .map((r) => `«${r.title}» (${r.cost})`);
    return `Команды: ${commands.join(', ')}.` + (rewards.length ? ` Награды за баллы: ${rewards.join(', ')}.` : '');
}

const isGame = (names) => names.includes((currentGame || '').toLowerCase());
const isDDNet = () => isGame(DDNET_CATEGORIES);
const isDota = () => isGame(DOTA_CATEGORIES);
const gameKey = () => isDDNet() ? 'ddnet' : isDota() ? 'dota' : null; // ключ game в REWARDS

ComfyJS.onCommand = async( user, command, message, flags, extra ) => {
    const inviteCommands = ["invite", "invitе"];
    const pointCommands = ["point", "points"];
    const MapCommands = ["map", "maps"];
    const Roll = ["roll"];
    const helpCommands = ["help", "команды", "commands"];
    state.stats.commands++;
    chat.add({ kind: 'command', user, color: extra && extra.userColor, text: `!${command}${message ? ' ' + message : ''}` });

    if( helpCommands.includes(command) ) {
        ComfyJS.Say(`@${user} ${helpText()}`);
        return;
    }

    // эти команды работают только на стримах по DDNet
    const ddnetCommands = [...inviteCommands, ...pointCommands, ...MapCommands];
    if( ddnetCommands.includes(command) && !isDDNet() ) {
        ComfyJS.Say(`@${user} !${command} работает только на стримах по DDNet`);
        return;
    }

    if( inviteCommands.includes(command) ) {
        //ComfyJS.Say("сегодня без инвайта "+user);
        DDnetInvite(user, message, user);
    }
    if( pointCommands.includes(command) ) {
        const Points = await DDnetPoint(message);
        ComfyJS.Say(Points);
    }
    if( Roll.includes(command) ) {
        ComfyJS.Say("roll: " + Math.floor(Math.random() * 101));
    }
    if( MapCommands.includes(command) ) {
        const Map = await DDnetMap(message || "IceRam");
        if (typeof Map === 'string') {
          let template = 'Игрок {nickname} не найден ни на одном сервере';
          let text = template.replace('{nickname}', message || "IceRam");
          ComfyJS.Say(text);
          return;
        }
        const player = Map[0]; 
        ComfyJS.Say("сейчас " + player.map + " ip: " + player.ip);
    }
    try {
        DDnetMessage(message, user);// выводит из чата твича в чат ddnet 
    } catch (error) {}
}

ComfyJS.onChat = ( user, message, flags, self, extra ) => {        //test
    if (!self) state.stats.messages++;
    chat.add({ kind: self ? 'bot' : 'message', user, color: extra && extra.userColor, text: message });
    let x = answer.answer(message);
    if (x !== 0) {
        console.log(`49 ${x}`);
        ComfyJS.Say(x);
    }
    try {
        DDnetMessage(message, user);// выводит из чата твича в чат ddnet 
    } catch (error) {
    }
    
}

// Награды за баллы канала. Бот сам создаёт и показывает награды текущей игры (game) и скрывает их,
// когда категория меняется, стрим заканчивается или бот выключается через Ctrl+C.
// Скрывает, а не удаляет: так очередь погашений сохраняется и баллы можно вернуть позже.
// Узнаёт награду по названию — оно должно быть уникальным на канале. Цену, описание и кулдаун меняйте здесь.
const REWARDS = {
    reverse: {
        game: 'ddnet',
        title: 'Реверс управления',
        cost: 1000,
        prompt: 'На 30 секунд меняет местами A↔D, W↔S и кнопки мыши у стримера',
        global_cooldown_seconds: 60 // реверс длится 30 секунд — второй не запустится поверх первого
    },
    dotaChat: {
        game: 'dota',
        title: 'Сообщение в чат Доты',
        cost: 50,
        prompt: 'Напиши сообщение — бот отправит его в общий чат Доты (до 120 символов)',
        is_user_input_required: true,
        global_cooldown_seconds: 10
    },
    dotaSkill: {
        game: 'dota',
        title: 'Способность в Доте',
        cost: 200,
        prompt: 'Напиши одну букву: q w e r d f — бот нажмёт эту способность',
        is_user_input_required: true,
        global_cooldown_seconds: 10
    }
};

// Если награда не сработала — бот сразу возвращает зрителю баллы и пишет причину в чат.
// Если сработала — погашение остаётся в очереди наград: вернуть баллы или нет, решаете вы в панели автора.
ComfyJS.onReward = async ( user, reward, cost, message, extra ) => {
    console.log( user + " redeemed " + reward + " for " + cost + " id " + extra.reward.id);
    chat.add({ kind: 'reward', user, reward, cost, text: message });
    const title = (reward || '').toLowerCase();
    const is = (key) => title === REWARDS[key].title.toLowerCase();

    let error; // текст для зрителя, если не получилось; null — получилось
    if (is('reverse')) error = await Reverse();
    else if (is('dotaChat')) error = await DotaAction('chat', message);
    else if (is('dotaSkill')) error = await DotaAction('skill', message);
    else return; // награда не бота — не трогаем

    state.stats.redemptions++;
    if (error) {
        const refunded = await Bounty.refund(extra.reward.id, extra.customRewardId);
        if (refunded) state.stats.refunds++;
        ComfyJS.Say(`@${user} ${error}${refunded ? ' — баллы возвращены' : ''}`);
    }
}

// Возвращает null, если реверс включился, иначе — причину для зрителя
async function Reverse() {
    if (!isDDNet()) return 'реверс работает только на стримах по DDNet';
    try {
        const results = await PythonShell.run(py('reverse.py'));
        // эту строку reverse.py пишет, когда перехват клавиш включился; без неё реверса не было
        // (например, в config/blocking.json стоит "block": "False" или не хватило прав)
        if (results.some((line) => line.includes('Keyboard hook successfully installed'))) return null;
        console.warn(`reverse.py не включил реверс: ${results.join(' | ')}`);
        return 'реверс не включился';
    }
    catch(err){
        console.error(`reverse.py упал: ${err.message}`);
        return 'реверс не включился, что-то сломалось';
    }
}

// Возвращает null, если действие в Доте выполнено, иначе — причину для зрителя
async function DotaAction(action, message) {
    if (!isDota()) return 'это работает только на стримах по Доте';
    try {
        // dota.py сам проверяет, что Дота на экране, и отвечает строкой "OK ..." или "ERR причина"
        const results = await PythonShell.run(py('dota.py'), { args: [action, message || ''] });
        const answer = results.join(' ');
        console.log(`dota.py: ${answer}`);
        return answer.startsWith('ERR') ? answer.slice(4) : null;
    }
    catch(err){
        console.error(`dota.py упал: ${err.message}`);
        return 'не получилось, что-то сломалось';
    }
}

async function Nike(x){ // just see ';'
    let a = true;
    if(x.includes(";")){ a = false }
    return a;
}

async function DDnetMessage(message, Sender=null){ // выводит из чата твича в чат ddnet 
    if(await Nike(message)){
        DDnetConsole(`echo ==> "${Sender ? Sender : "No info"}: ${message}"`)
    }
    else
        console.log("лох перезапуск (;)");
}

async function DDnetInvite(user, message, Sender=null){
    if(await Nike(message)){
        DDnetConsole(`say /invite "${message}";echo INVITE "${Sender ? Sender : "No info"}: ${message}"`)
        ComfyJS.Say(user + " инвайтнул " + message);
    }
    else{
        console.log("лох перезапуск (;)");
    }
}

async function DDnetPoint(message){
    console.log(`Attempting to get points for: ${message}`);
    try {
        const results = await PythonShell.run(py('point.py'), {args: [`${message}`]});
        const pointsOutput = results.join(' ');
        return `${message} points: ${pointsOutput}`;
    }
    catch(err){
        console.error("Error in DDnetPoint while running point.py:", err);
        return `Sorry, I could not check points for ${message} right now.`;
    }
}

// Реклама в чате DDNet: текст, интервал и вкл/выкл — в config/ad.json или в интерфейсе (инструмент «Реклама»).
// Таймер запускается в init(), отправка — только когда категория DDNet.
async function DDnetReklama(text){
    const sent = await DDnetConsole(`say ${text}`);
    if (sent) console.log('Реклама отправлена в чат DDNet');
    return sent;
}

async function DDnetMap(message){
    try {
    const переменная = await DDMap.findPlayerAndMap(message);
    return переменная
    }
      catch(err){
          console.error(`DDnetMap ${err}`);
    }
}

// Возвращает true, если команда ушла в DDNet
async function DDnetConsole(x) {
    // Единственный путь в DDNet: эхо чата, реклама и инвайт идут через эту функцию.
    // Не DDNet — не отправляем вообще, даже не запускаем ddnet_pipe.py.
    if (!isDDNet()) return false;
    try {
        await PythonShell.run(py('ddnet_pipe.py'), {args: x});
        if (state.ddnet.ok === false) console.log('Связь с DDNet восстановлена');
        state.ddnet.ok = true;
        return true;
    }
    catch(err){
        // пишем об ошибке один раз, а не на каждое сообщение из чата
        if (state.ddnet.ok !== false) console.error(`Не удалось отправить команду в DDNet — клиент запущен и в нём включён cl_input_fifo? (${err.message})`);
        state.ddnet.ok = false;
        return false;
    }
}
// ComfyJS.onJoin = ( user, self, extra ) => {  // ¯\_(ツ)_/¯ Кто зашел в чат
//     console.log("фолов " + user);
//     ComfyJS.Say("qq @"+ user);
// }
ComfyJS.onConnected = () => {
    state.chatConnected = true;
    console.log('Подключился к чату Twitch');
};
ComfyJS.onReconnect = () => {
    state.chatConnected = false;
    console.warn('Связь с чатом Twitch пропала — переподключаюсь...');
};
ComfyJS.onError = (err) => console.error(`Twitch: ${err && err.message ? err.message : err}`);

// ---------- Интерфейс в терминале ----------
// Панели «Стрим», «Инструменты», «Логи», «Ошибки» — см. src/ui. Без интерфейса: npm run start:plain
// Всё, что умеют инструменты (src/ui/menu.js), собрано здесь:
const bot = {
    state,
    ad,
    isDDNet: () => isDDNet(),
    isDota: () => isDota(),
    async setTitle(text) {
        const title = String(text).trim();
        if (!title) throw new Error('Название пустое');
        if ([...title].length > twitch.TITLE_MAX) throw new Error(`Не больше ${twitch.TITLE_MAX} символов`);
        await twitch.setTitle(title);
        state.title = title;
        console.log(`Название стрима: ${title}`);
        return 'Название обновлено';
    },
    async sendAdNow() {
        if (!isDDNet()) throw new Error('Реклама уходит только в чат DDNet, а сейчас категория не DDNet');
        if (!await ad.sendNow()) throw new Error('Не отправилось — DDNet запущен и в нём включён cl_input_fifo?');
        return 'Реклама отправлена';
    },
    async setForcedGame(game) {
        state.forcedGame = game;
        await StreamCategory();
        return game ? `Категория: ${game} (вручную)` : 'Категория снова берётся с Twitch';
    },
    async setRewardsPaused(paused) {
        state.rewardsPaused = paused;
        await StreamCategory();
        return paused ? 'Награды скрыты' : 'Награды показаны по категории';
    },
    refreshToken: () => needed.refreshNow(),
    clearLogs() {
        log.clear();
        return 'Логи очищены';
    }
};

let ui = null;
function startInterface() {
    const plain = process.argv.includes('--plain') || !process.stdout.isTTY || !process.stdin.isTTY;
    if (plain) return null;
    const { startUI } = require('./ui/app');
    const { streamPanel } = require('./ui/stream-panel');
    const menu = require('./ui/menu');
    return startUI({
        streamPanel: (width) => streamPanel(bot, width),
        menu: menu(bot),
        onExit: () => shutdown(0)
    });
}

async function init(){
    ui = startInterface();
    const tokensRefreshed = await needed.refreshAllTokens();
    if (tokensRefreshed)
        console.log("Tokens refreshed")
    else
        console.log('Failed to refresh tokens')
    await StreamCategory(); // узнаём категорию до первого сообщения из чата (и сразу приводим награды в порядок)
    setInterval(StreamCategory, CATEGORY_CHECK_MS);
    ComfyJS.Init(process.env.TWITCHUSER, process.env.OAUTH );
    needed.startTokenRefresh(ComfyJS); // обновляем токен во время стрима, до того как он истечёт
    needed.keepTokenFresh();           // и сразу узнаём, сколько он ещё проживёт
    ad.start(DDnetReklama);            // таймер рекламы в чате DDNet
}

// Выход: Ctrl+C, «0 → Да» в интерфейсе или закрытие окна крестиком.
// Перед выходом скрываем награды бота, чтобы зрители не тратили баллы, пока бот выключен.
let stopping = false;
async function shutdown(code = 0) {
    if (stopping || !process.env.OAUTH) { // второй Ctrl+C — выйти сразу
        if (ui) ui.stop();
        process.exit(code);
    }
    stopping = true;
    console.log('Выключаюсь: скрываю награды бота...');
    await Promise.race([Bounty.syncRewards(REWARDS, null), new Promise((r) => setTimeout(r, 8000))]);
    if (ui) ui.stop();
    log.print('Бот остановлен.');
    process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0)); // Windows присылает его, когда окно консоли закрывают крестиком
process.on('unhandledRejection', (err) => console.error('Ошибка:', err && err.message ? err.message : err));
process.on('uncaughtException', (err) => {
    console.error('Бот упал:', err && err.stack ? err.stack : err);
    shutdown(1);
});
if(process.env.TWITCHUSER && process.env.OAUTH && process.env.CLIEN && process.env.REFRESH){
    init()
}
else{
    // .env пустой или неполный — заполняем автоматически через браузер
    require('./setup.js').setup()
        .then(() => init())
        .catch((err) => console.log("Не удалось заполнить .env: " + err.message + "\nЗапустите: npm run setup"));
}

module.exports = { bot }; // для автотестов