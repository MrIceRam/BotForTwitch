const Bounty = require('./bounty.js');
require('dotenv').config();
const ComfyJS = require("comfy.js");
const { PythonShell } = require('python-shell');
const answer = require("./answer.js");
ComfyJS.onCommand = ( user, command, message, flags, extra ) => {    // !test
  if( command === "invite" ) {  DDnet(message);}}


// ComfyJS.onChat = ( user, message, flags, self, extra ) => {        //test
//     x = answer.answer(message);
//     if (x == 0){
//       console.log("eerr");

//     }
//     else{
//       console.log("wwee");
//       ComfyJS.Say(x);
//     }


  // if(message.startsWith("!invite")) // message === "teststr" for full
    // {
    //     ComfyJS.Say("da")
    // }
//}


ComfyJS.onReward = ( user, reward, cost, message, extra ) => {
    console.log( user + " redeemed " + reward + " for " + cost + " id " + extra.reward.id);
    if (extra.reward.id === "1d04d1f0-215a-419b-9702-5171334ed879"){
        PythonShell.run('reverse.py')
    }
} // юзер + название + цена


// ComfyJS.onConnected = async(address, port, isFirstConnect) => {
//  let channelRewards = await ComfyJS.GetChannelRewards(process.env.CLIEN, true ); //награды которые есть на канале и они которые его
// if (channelRewards[0].title != "Test Reward"){
//      Bounty.createRevarte();  
// }
// }

async function DDnet(message){
    await PythonShell.run('ddnet_pipe.py', {args: [`say /invite "${message}";echo "${message}"`]}, (err, results) => {
        if (err) throw err;
        console.log('Результаты выполнения Python-скрипта:', results);
    });
}

ComfyJS.Init(process.env.TWITCHUSER, process.env.OAUTH );