require('dotenv').config();

function answer(message){
    if(message === "da"){
        return "хуй";
    }
    else{
        return 0;
    }
}
module.exports = { answer }