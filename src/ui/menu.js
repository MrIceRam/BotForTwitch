// Инструменты (левая нижняя панель). Пункт выбирается цифрой по порядку: 1, 2, 3… (не больше 9 в одном меню).
// 0 — назад, а в главном меню — выход.
//
// Чтобы добавить свой инструмент, добавьте объект в список:
//   { label: 'Подпись', action: async () => 'что написать после выполнения' }
//   { label: 'Подменю', items: () => [ ...такие же пункты ] }
//   { label: 'Ввод текста', input: {
//         prompt: 'Подсказка над полем',
//         initial: () => 'текст в поле при открытии',
//         maxLength: 100,
//         emoji: true,                      // Tab — быстрые эмодзи
//         onSubmit: async (text) => 'готово'
//   } }
// label (и title) может быть функцией — тогда подпись обновляется на лету, например «Реклама: вкл».
// Если action или onSubmit выбрасывает ошибку (throw new Error('текст')), текст покажется красным.

function adLabel(bot) {
    const ad = bot.ad.get();
    return ad.enabled ? `Реклама: вкл, каждые ${ad.intervalMinutes} мин` : 'Реклама: выкл';
}

module.exports = (bot) => [
    {
        label: () => adLabel(bot),
        title: 'Реклама в чате DDNet',
        items: () => [
            {
                label: 'Изменить текст',
                title: 'Текст рекламы',
                input: {
                    prompt: 'Это сообщение бот пишет в чат DDNet. Символ ; нельзя.',
                    initial: () => bot.ad.get().text,
                    maxLength: 200,
                    emoji: true,
                    onSubmit: (text) => bot.ad.setText(text)
                }
            },
            {
                label: () => `Интервал: каждые ${bot.ad.get().intervalMinutes} мин`,
                title: 'Интервал рекламы',
                input: {
                    prompt: 'Как часто отправлять рекламу — число минут от 1 до 180',
                    initial: () => String(bot.ad.get().intervalMinutes),
                    maxLength: 5,
                    onSubmit: (text) => bot.ad.setIntervalMinutes(text)
                }
            },
            {
                label: () => (bot.ad.get().enabled ? 'Выключить рекламу' : 'Включить рекламу'),
                action: () => bot.ad.toggle()
            },
            { label: 'Отправить сейчас', action: () => bot.sendAdNow() }
        ]
    },
    {
        label: 'Название стрима',
        input: {
            prompt: 'Новое название стрима на Twitch (до 140 символов)',
            initial: () => bot.state.title,
            maxLength: 140,
            emoji: true,
            onSubmit: (text) => bot.setTitle(text)
        }
    },
    {
        label: () => (bot.state.rewardsPaused ? 'Награды скрыты — показать' : 'Награды: скрыть все'),
        action: () => bot.setRewardsPaused(!bot.state.rewardsPaused)
    },
    {
        label: () => `Категория: ${bot.state.forcedGame ? `${bot.state.forcedGame} (вручную)` : 'как на Twitch'}`,
        title: 'Категория — для проверки без стрима',
        items: () => [
            { label: 'DDNet', action: () => bot.setForcedGame('DDNet') },
            { label: 'Dota 2', action: () => bot.setForcedGame('Dota 2') },
            { label: 'Как на Twitch', action: () => bot.setForcedGame(null) }
        ]
    },
    { label: 'Обновить токен сейчас', action: () => bot.refreshToken() },
    { label: 'Очистить логи', action: () => bot.clearLogs() }
];
