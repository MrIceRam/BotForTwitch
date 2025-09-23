const Bounty = require('./commands/bounty.js');
require('dotenv').config();
const ComfyJS = require("comfy.js");
const { PythonShell } = require('python-shell');
const answer = require("./commands/answer.js");
const needed = require("./commands/Needed.js");
ComfyJS.onCommand = ( user, command, message, flags, extra ) => {    // !test
  if( command === "invite" ) {  DDnetInvite(message, user);}}


ComfyJS.onChat = ( user, message, flags, self, extra ) => {        //test
    let x = answer.answer(message);

    if (x !== 0) {
        console.log(`Written answer ${x}`);
        ComfyJS.Say(x);
    }


    // if(message.startsWith("!invite")) // message === "teststr" for full
    // {
    //     ComfyJS.Say("da")
    // }
//}
}


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

async function Nike(x) {
    let a = true;
    for (let i = 0; i<x.length;i++){
        if(x[i]=== ";"){
        a = false;
        break;
        }
    }
    return a;
}

async function DDnetInvite(message, Sender=null){
  if(await Nike(message)){
      await PythonShell.run('ddnet_pipe.py', {args: [`say /invite "${message}";echo "${Sender ? Sender : "No info"}: ${message}"`]}, (err, results) => {
          if (err) throw err;
          console.log('Результаты выполнения Python-скрипта:', results);
      });
  }
  else
     console.log("; blocked");
}

async function init()
{
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
else
{
    console.log("THere no OAUTH tokens in .env file \n" +
        "U need that tokens: \n" +
        "TWITCHUSER= \n" +
        "OAUTH= \n" +
        "CLIEN= \n" +
        "REFRESH= \n")
}