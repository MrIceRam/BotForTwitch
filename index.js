var Bounty = require('./bounty.js')
require('dotenv').config();
var ComfyJS = require("comfy.js");
const { PythonShell } = require('python-shell');
// ComfyJS.onCommand = ( user, command,message, flags, extra ) => {    // !test
//   if( command === "test" ) {  ComfyJS.Say( "da" );}}  
 ComfyJS.onChat = ( user, message, flags, self, extra ) => {        //test
    if(message.startsWith("д а")) // message === "teststr" for full
    {
        ComfyJS.Say("da")
    }
}
// ComfyJS.onReward = ( user, reward, cost, message, extra ) => {
//     console.log( user + " redeemed " + reward + " for " + cost );} // юзер + название + цена

ComfyJS.onConnected = async(address, port, isFirstConnect) => {
let channelRewards = await ComfyJS.GetChannelRewards(process.env.CLIEN, true );
if (channelRewards[0].title != "Test Reward"){
    Bounty.createRevarte();  
}
}

    PythonShell.run('script.py', null, (err, results) => {
      if (err) throw err;
      console.log('Результаты выполнения Python-скрипта:', results);
    });

ComfyJS.Init(process.env.TWITCHUSER, process.env.OAUTH );