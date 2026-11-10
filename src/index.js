const Bounty = require('./commands/bounty.js');
require('dotenv').config();
const axios = require('axios');
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
//   DDNet  — чат в игре, реклама, инвайт, реверс за баллы
//   Dota 2 — сообщение в общий чат и способности за баллы, в DDNet НИЧЕГО не отправляется
//   оффлайн или другая игра — ничего из этого
// Для проверки без стрима добавь в .env строку FORCE_GAME=Dota 2 (или FORCE_GAME=DDNet)
const DDNET_CATEGORIES = ['ddnet', 'ddracenetwork', 'ddrace network']; // точное название на Twitch бот пишет в консоль
const DOTA_CATEGORIES = ['dota 2'];
const CATEGORY_CHECK_MS = 60 * 1000; // категорию можно сменить посреди стрима — проверяем раз в минуту

let currentGame = null; // null = оффлайн или ещё не узнали

async function StreamCategory() {
    try {
        let newGame = process.env.FORCE_GAME || null;
        if (!newGame) {
            const { data } = await axios.get('https://api.twitch.tv/helix/streams', {
                params: { user_login: process.env.TWITCHUSER },
                headers: {
                    'Client-ID': process.env.CLIEN,
                    'Authorization': `Bearer ${process.env.OAUTH}`
                },
                timeout: 10000
            });
            // если стрим оффлайн — data.data пустой массив
            newGame = data.data.length > 0 ? data.data[0].game_name : null;
        }
        if (newGame !== currentGame) {
            console.log(`Категория стрима: ${newGame || 'оффлайн'}${process.env.FORCE_GAME ? ' (FORCE_GAME из .env)' : ''}`);
        }
        currentGame = newGame;
    } catch (err) {
        // старую категорию не сбрасываем: из-за одного сбоя сети стрим не должен "становиться оффлайн"
        console.log('Не удалось получить категорию стрима:', err.message);
    }
}

const isGame = (names) => names.includes((currentGame || '').toLowerCase());
const isDDNet = () => isGame(DDNET_CATEGORIES);
const isDota = () => isGame(DOTA_CATEGORIES);

ComfyJS.onCommand = async( user, command, message, flags, extra ) => {
    const inviteCommands = ["invite", "invitе"];
    const pointCommands = ["point", "points"];
    const MapCommands = ["map", "maps"];
    const Roll = ["roll"];
    
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

const REWARDS = {
    reverse: '1d04d1f0-215a-419b-9702-5171334ed879',
    dotaChat: 'Сообщение в чат Доты',
    dotaSkill: 'Способность в Доте',
};

ComfyJS.onReward = ( user, reward, cost, message, extra ) => {
    console.log( user + " redeemed " + reward + " for " + cost + " id " + extra.reward.id);
    const title = (reward || '').toLowerCase();

    if (extra.reward.id === REWARDS.reverse){
        if (isDDNet()) PythonShell.run(py('reverse.py'));
        else ComfyJS.Say(`@${user} реверс работает только на стримах по DDNet`);
    }
    else if (title === REWARDS.dotaChat.toLowerCase()) {
        DotaAction(user, 'chat', message);
    }
    else if (title === REWARDS.dotaSkill.toLowerCase()) {
        DotaAction(user, 'skill', message);
    }
}

async function DotaAction(user, action, message) {
    if (!isDota()) {
        ComfyJS.Say(`@${user} это работает только на стримах по Доте`);
        return;
    }
    try {
        // dota.py сам проверяет, что Дота на экране, и отвечает строкой "OK ..." или "ERR причина"
        const results = await PythonShell.run(py('dota.py'), { args: [action, message || ''] });
        const answer = results.join(' ');
        console.log(`dota.py: ${answer}`);
        if (answer.startsWith('ERR')) ComfyJS.Say(`@${user} ${answer.slice(4)}`);
    }
    catch(err){
        console.log(`dota.py упал: ${err.message}`);
        ComfyJS.Say(`@${user} не получилось, что-то сломалось`);
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
    if (!isDDNet()) {
        ComfyJS.Say(`@${user} инвайт работает только на стримах по DDNet`);
        return;
    }
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

async function DDnetReklama(){
    DDnetConsole(`say Не чувак это было реально круто`)
    //DDnetConsole(`say ＭｒＩｃｅＲａｍ Stream online! twitch.tv/MrIceRam !!!_ ДЛЯ ИНВАЙТА ПИШИТЕ !invite СВОЙНИК, В ЧАТЕ twitch.tv/MrIceRam, ЧТОБЫ Бот ИНВАЙТНУЛ вас _!!!`)
}

setInterval(
  () => {
    console.log('300 seconds');//ＭｒＩｃｅＲａｍ Stream online! twitch.tv/MrIceRam !!!_ ДЛЯ ИНВАЙТА ПИШИТЕ !invite (ник), В ЧАТЕ twitch.tv/MrIceRam, ЧТОБЫ ВАС ИНВАЙТНУЛ БОТ _!!!
    DDnetReklama();                    
  },
  300 * 1000
);

async function DDnetMap(message){
    try {
    const переменная = await DDMap.findPlayerAndMap(message);
    return переменная
    }
      catch(err){
          console.log(`DDnetMap ${err}`);
    }
}

async function DDnetConsole(x) {
    // Единственный путь в DDNet: эхо чата, реклама и инвайт идут через эту функцию.
    // Не DDNet — не отправляем вообще, даже не запускаем ddnet_pipe.py.
    if (!isDDNet()) return;
    try {
        await PythonShell.run(py('ddnet_pipe.py'), {args: x}, (err, results) => {
            if (err) throw err;
            console.log('DDnetConsole good')
        });
    }
    catch(err){
        console.log("err");
        //console.log(err);
    }
}
// ComfyJS.onJoin = ( user, self, extra ) => {  // ¯\_(ツ)_/¯ Кто зашел в чат
//     console.log("фолов " + user);
//     ComfyJS.Say("qq @"+ user);
// }
async function init(){
    const tokensRefreshed = await needed.refreshAllTokens();
    if (tokensRefreshed)
        console.log("Tokens refreshed")
    else
        console.log('Failed to refresh tokens')
    await StreamCategory(); // узнаём категорию до первого сообщения из чата
    setInterval(StreamCategory, CATEGORY_CHECK_MS);
    ComfyJS.Init(process.env.TWITCHUSER, process.env.OAUTH );
}
if(process.env.TWITCHUSER && process.env.OAUTH && process.env.CLIEN && process.env.REFRESH){
    init()
}
else{
    // .env пустой или неполный — заполняем автоматически через браузер
    require('./setup.js').setup()
        .then(() => init())
        .catch((err) => console.log("Не удалось заполнить .env: " + err.message + "\nЗапустите: npm run setup"));
}