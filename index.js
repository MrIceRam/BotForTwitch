var Bounty = require('./bounty.js')
require('dotenv').config();
var ComfyJS = require("comfy.js");


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
console.log(channelRewards[0].title);

//Bounty.createRevarte();
    
}

ComfyJS.Init(process.env.TWITCHUSER, process.env.OAUTH );