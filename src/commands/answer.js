require('dotenv').config();

function random2(max){
    return Math.floor(Math.random() * max);
}

function answer(message){
    switch (message) {
        case "окак":
            return "отак";
        case "иди нахуй":
            return "0_0";
        case "пошел нахуй":
            return "0_0";
        case "создатель":
            return "MrIceRam and 1Voix1";
        case "пизда":
            return "в анусе звезда";
        case "сосал":
            return (random2(51) === 0 ? "да" : "Нет")
        case "сосал?":
            return (random2(51) === 0 ? "да" : "Нет") 
        default:
            return 0;
    }
}
module.exports = { answer }