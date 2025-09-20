var Bounty = require('./bounty.js')
require('dotenv').config();
var ComfyJS = require("comfy.js");
const { PythonShell } = require('python-shell');
ComfyJS.onCommand = ( user, command, message, flags, extra ) => {    // !test
  if( command === "invite" ) {  DDnet(message);}}  

// ComfyJS.onChat = ( user, message, flags, self, extra ) => {        //test
//     if(message.startsWith("!invite")) // message === "teststr" for full
//     {
//         ComfyJS.Say("da")
//     }
// }
// ComfyJS.onReward = ( user, reward, cost, message, extra ) => {
//     console.log( user + " redeemed " + reward + " for " + cost );} // юзер + название + цена

//ComfyJS.onConnected = async(address, port, isFirstConnect) => {
// let channelRewards = await ComfyJS.GetChannelRewards(process.env.CLIEN, true ); //награды которые есть на канале и они которые его
// if (channelRewards[0].title != "Test Reward"){
//     Bounty.createRevarte();  
// }
//}

async function DDnet(message){
    PythonShell.run('ddnet_pipe.py',{ args: ["say /invite", message] }, (err, results) => {
      if (err) throw err;
      console.log('Результаты выполнения Python-скрипта:', results);
    });
}

ComfyJS.Init(process.env.TWITCHUSER, process.env.OAUTH );