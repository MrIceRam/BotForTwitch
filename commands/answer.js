require('dotenv').config();

function random2(max){
    return Math.floor(Math.random() * max);
}

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
    if(message === "создатель"){
        return "MrIceRam";
    }
    
    
     if(message === "сосал"){ //voix return (random2(11) === 0 ? "Да" : "Нет")
        
        if(random2(10) == 1){
            return "да";
        }else{
            return "нет";
        }
    }

    else{
        return 0;
    }
}
module.exports = { answer }