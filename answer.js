var Bounty = require('./bounty.js')
require('dotenv').config();
var ComfyJS = require("comfy.js");


async function answer(message){
    if(message == "da"){
        console.log("answer")
        return "хуй";
    }
    else{
        return 0;
    }
};
module.exports = { answer }