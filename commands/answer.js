require('dotenv').config();
const ComfyJS = require("comfy.js");


function answer(message){
    if(message === "da"){
        return "хуй";
    }
    else{
        return 0;
    }
}
module.exports = { answer }