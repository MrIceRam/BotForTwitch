// Общее состояние бота. Его заполняют разные части бота, а интерфейс (src/ui) только читает и рисует.
module.exports = {
    channel: '',            // логин канала (TWITCHUSER)
    live: false,            // идёт ли стрим
    twitchGame: null,       // категория на Twitch (когда стрим идёт)
    forcedGame: null,       // категория, выбранная вручную: FORCE_GAME в .env или инструмент «Категория»
    game: null,             // категория, по которой сейчас работает бот (вручную или с Twitch)
    title: '',              // название стрима
    viewers: null,          // зрителей сейчас
    startedAt: null,        // когда начался стрим (Date)
    chatConnected: false,   // подключён ли бот к чату Twitch
    tokenExpiresAt: null,   // когда истечёт токен (мс, как Date.now())
    rewards: [],            // награды бота на Twitch: [{ title, cost, visible }]
    rewardsPaused: false,   // награды скрыты вручную (инструмент «Награды»)
    ddnet: { ok: null },    // связь с клиентом DDNet: true / false / null — ещё не проверялась
    stats: { messages: 0, commands: 0, redemptions: 0, refunds: 0 } // за время работы бота
};
