require('dotenv').config();

function random2(max){
    return Math.floor(Math.random() * max);
}

function answer(message){
    switch (message) {
        case "окак":
            return "отак";
        case "что за карта":
            return "туториал";
        case "иди нахуй":
            return "0_0";
        case "пошел нахуй":
            return "0_0";
        case "сосал":
            return (random2(11) === 0 ? "Да" : "Нет")
        default:
            return 0;
    }
}
module.exports = { answer }