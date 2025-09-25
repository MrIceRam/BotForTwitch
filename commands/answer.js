require('dotenv').config();

function answer(message){
    if(message === "окак"){
        return "отак";
    }
    if(message === "что за карта"){
        return "туториал";
    }
    if(message === "иди нахуй"){
        return "0_0";
    }
    if(message === "пошел нахуй"){
        return "0_0";
    }
    else{
        return 0;
    }
}
module.exports = { answer }