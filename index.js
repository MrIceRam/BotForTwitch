const Bounty = require('./commands/bounty.js');
require('dotenv').config();
const ComfyJS = require("comfy.js");
const { PythonShell } = require('python-shell');
const answer = require("./commands/answer.js");
const needed = require("./commands/Needed.js");
const DDMap = require("./commands/DDMap.js");


ComfyJS.onCommand = async( user, command, message, flags, extra ) => {
    const inviteCommands = ["invite", "invitе", "инвайт", "инвит"];
    const pointCommands = ["point", "points"];
    const MapCommands = ["map", "maps", "карта", "мапа", "мапка"];
    
    if( inviteCommands.includes(command) ) {
        DDnetInvite(message, user);
    }
    if( pointCommands.includes(command) ) {
        const Points = await DDnetPoint(message);
        ComfyJS.Say(Points);
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
}

ComfyJS.onChat = ( user, message, flags, self, extra ) => {        //test
    let x = answer.answer(message);
    if (x !== 0) {
        console.log(`Written answer ${x}`);
        ComfyJS.Say(x);
    }
    //DDnetMessage(message, user);// выводит из чата твича в чат ddnet 

    // выводит из чата твича в чат ddnet 
    // try { 
    //           PythonShell.run('ddnet_pipe.py', {args: [`echo "${message}"`]}, (err, results) => {
    //           if (err) throw err;
    //           //console.log('xyu')
    //           console.log('Результаты выполнения Python-скрипта:', results);
    //       });
    //   }
    //   catch(err){
    //       console.log(err);
    //   }

}

    // if(message.startsWith("!invite")){ // message === "teststr" for full
    // {
    //     ComfyJS.Say("da")
    // }
    // }

ComfyJS.onReward = ( user, reward, cost, message, extra ) => {
    console.log( user + " redeemed " + reward + " for " + cost + " id " + extra.reward.id);
    if (extra.reward.id === "1d04d1f0-215a-419b-9702-5171334ed879"){
        PythonShell.run('reverse.py')
    }
} // юзер + название + цена

// ComfyJS.onJoin = ( user, self, extra ) => {  // ¯\_(ツ)_/¯ Кто зашел в чат
//     console.log("фолов " + user);
//     ComfyJS.Say("Привет "+ user);
// }

// ComfyJS.onConnected = async(address, port, isFirstConnect) => {
//  let channelRewards = await ComfyJS.GetChannelRewards(process.env.CLIEN, true ); //награды которые есть на канале и они которые его
// if (channelRewards[0].title != "Test Reward"){
//      Bounty.createRevarte();  
// }
// }

async function Nike(x){ // just see ';'
    let a = true;
    if(x.includes(";")){ a = false }
    return a;
}

// async function DDnetMessage(message, Sender=null){ // выводит из чата твича в чат ddnet 
//   if(await Nike(message)){
//       try {
//           await PythonShell.run('ddnet_pipe.py', {args: [`echo ==> "${Sender ? Sender : "No info"}: ${message}"`]}, (err, results) => {
//               if (err) throw err;
//               console.log('Результаты выполнения Python-скрипта:', results);
//           });
//       }
//       catch(err){
//           console.log(err);
//       }
//     }
//     else
//         console.log("лох перезапуск (;)");
// }

async function DDnetInvite(message, Sender=null){
  if(await Nike(message)){
      try {
          await PythonShell.run('ddnet_pipe.py', {args: [`say /invite "${message}";echo ==>"${Sender ? Sender : "No info"}: ${message}"`]}, (err, results) => {
              if (err) throw err;
              console.log('Результаты выполнения Python-скрипта:', results);
          });
      }
      catch(err){
          console.log(err);
      }
    }
    else
        console.log("лох перезапуск (;)");
}

async function DDnetPoint(message){
    console.log(`Attempting to get points for: ${message}`);
    try {
        // PythonShell.run returns a promise that resolves to an array of output lines
        const results = await PythonShell.run('./commands/point.py', {args: [`${message}`]});

        // Join the array of lines into a single string for output
        const pointsOutput = results.join(' ');

        // Return the formatted message string
        return `${message} points: ${pointsOutput}`;
    }
    catch(err){
        console.error("Error in DDnetPoint while running point.py:", err);
        // Ensure a string is always returned to prevent the TypeError in ComfyJS.Say()
        return `Sorry, I could not check points for ${message} right now.`;
    }
}

async function DDnetReklama(){ // POINT DDNET
    try {
          await PythonShell.run('ddnet_pipe.py', {args: [`say ＭｒＩｃｅＲａｍ Stream online! twitch.tv/MrIceRam !!!_ ДЛЯ ИНВАЙТА ПИШИТЕ !invite (ник), В ЧАТЕ twitch.tv/MrIceRam, ЧТОБЫ ВАС ИНВАЙТНУЛ БОТ _!!!`]}, (err, results) => {
              if (err) throw err;
              //console.log('xyu')
              console.log('Результаты выполнения Python-скрипта:', results);
          });
      }
      catch(err){
          console.log(err);
      }
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