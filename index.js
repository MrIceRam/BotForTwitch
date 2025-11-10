const Bounty = require('./commands/bounty.js');
require('dotenv').config();
const ComfyJS = require("comfy.js");
const { PythonShell } = require('python-shell');
const answer = require("./commands/answer.js");
const needed = require("./commands/Needed.js");
const DDMap = require("./commands/DDMap.js");
//const { use } = require('react');

ComfyJS.onCommand = async( user, command, message, flags, extra ) => {
    const inviteCommands = ["invite", "invitе"];
    const pointCommands = ["point", "points"];
    const MapCommands = ["map", "maps"];
    const Roll = ["roll"];
    
    if( inviteCommands.includes(command) ) {
        //ComfyJS.Say("два трая без инвайта "+user);
        DDnetInvite(message, user);
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
        console.log(`47 ${x}`);
        ComfyJS.Say(x);
    }
    try {
        DDnetMessage(message, user);// выводит из чата твича в чат ddnet 
    } catch (error) {
    }
    
}

ComfyJS.onReward = ( user, reward, cost, message, extra ) => {
    console.log( user + " redeemed " + reward + " for " + cost + " id " + extra.reward.id);
    if (extra.reward.id === "1d04d1f0-215a-419b-9702-5171334ed879"){
        PythonShell.run('reverse.py')
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

async function DDnetInvite(message, Sender=null){
    if(await Nike(message)){
        DDnetConsole(`say /invite "${message}";echo INVITE "${Sender ? Sender : "No info"}: ${message}"`)
    }
    else{
        console.log("лох перезапуск (;)");
    }
}

async function DDnetPoint(message){
    console.log(`Attempting to get points for: ${message}`);
    try {
        const results = await PythonShell.run('./commands/point.py', {args: [`${message}`]});
        const pointsOutput = results.join(' ');
        return `${message} points: ${pointsOutput}`;
    }
    catch(err){
        console.error("Error in DDnetPoint while running point.py:", err);
        return `Sorry, I could not check points for ${message} right now.`;
    }
}

async function DDnetReklama(){
    //DDnetConsole(`say ＭｒＩｃｅＲａｍ Stream online! twitch.tv/MrIceRam`)
    DDnetConsole(`say ＭｒＩｃｅＲａｍ Stream online! twitch.tv/MrIceRam !!!_ ДЛЯ ИНВАЙТА ПИШИТЕ !invite (ник), В ЧАТЕ twitch.tv/MrIceRam, ЧТОБЫ ВАС ИНВАЙТНУЛ БОТ _!!!`)
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
          console.log(err);
    }
}

async function DDnetConsole(x) {
    try {
        await PythonShell.run('ddnet_pipe.py', {args: x}, (err, results) => {
            if (err) throw err;
            console.log('DDnetConsole good')
        });
    }
    catch(err){
        console.log("err");
        //console.log(err);
    }
}

async function init(){
    const tokensRefreshed = await needed.refreshAllTokens();
    if (tokensRefreshed)
        console.log("Tokens refreshed")
    else
        console.log('Failed to refresh tokens')
    ComfyJS.Init(process.env.TWITCHUSER, process.env.OAUTH );
}
if(process.env.TWITCHUSER && process.env.OAUTH && process.env.CLIEN && process.env.REFRESH){
    init()
}
else{
    console.log("THere no OAUTH tokens in .env file \n" +
        "U need that tokens: \n" +
        "TWITCHUSER= \n" +
        "OAUTH= \n" +
        "CLIEN= \n" +
        "REFRESH= \n")
}