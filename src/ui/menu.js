// Инструменты (левая нижняя панель). Пункт выбирается цифрой по порядку: 1, 2, 3… (не больше 9 в одном меню).
// 0 — назад, а в главном меню — выход.
//
// Чтобы добавить свой инструмент, добавьте объект в список:
//   { label: 'Подпись', action: async () => 'что написать после выполнения' }
//   { label: 'Подпись', action: ..., back: true }   — после выполнения вернуться в меню выше
//   { label: 'Подменю', items: () => [ ...такие же пункты ] }
//   { label: 'Подменю', items: ..., onOpen: async () => 'загружено' }   — сделать что-то при открытии подменю
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
        // погашения, которые сработали и ждут решения: вернуть баллы или оставить
        label: () => `Очередь наград${bot.state.queueLoaded || bot.state.queue.length ? `: ${bot.state.queue.length}` : ''}`,
        title: 'Очередь наград — ждут решения',
        onOpen: () => bot.loadQueue(),
        items: () => {
            const queue = bot.state.queue;
            if (!queue.length) return [{ label: 'Очередь пуста — обновить', action: () => bot.loadQueue() }];
            const list = queue.slice(0, 7).map((item) => ({
                label: `${item.user} — ${item.reward}${item.text ? `: ${item.text}` : ''}`,
                title: `${item.user}: ${item.reward}`,
                items: () => [
                    { label: 'Вернуть баллы', action: () => bot.decide(item, true), back: true },
                    { label: 'Выполнено (баллы остаются)', action: () => bot.decide(item, false), back: true }
                ]
            }));
            list.push({ label: queue.length > 7 ? `Обновить (ещё ${queue.length - 7})` : 'Обновить', action: () => bot.loadQueue() });
            list.push({ label: 'Отметить все выполненными', action: () => bot.fulfillAll() });
            return list;
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
            { label: 'CS2', action: () => bot.setForcedGame('Counter-Strike') },
            { label: 'Как на Twitch', action: () => bot.setForcedGame(null) }
        ]
    },
    {
        label: 'Оверлей для OBS',
        title: 'Оверлей наград для OBS',
        items: () => [
            { label: 'Показать тестовую награду', action: () => bot.testOverlay() },
            { label: 'Скопировать ссылку для OBS', action: () => bot.overlay.copyLink() },
            { label: 'Скопировать ссылку на ленту', action: () => bot.overlay.copyLink(true) },
            { label: 'Открыть в браузере', action: () => bot.overlay.openInBrowser() },
            {
                label: 'Алерты: фолловы, подписки, рейды',
                title: 'Алерты на оверлее',
                items: () => bot.overlay.alertKinds().map(({ kind, name }) => ({
                    label: () => `${name}: ${bot.overlay.alertEnabled(kind) ? 'вкл' : 'выкл'}`,
                    action: () => bot.overlay.toggleAlert(kind)
                }))
            }
        ]
    },
    { label: 'Итоги стрима', action: () => bot.saveSummary() },
    { label: 'Обновить токен сейчас', action: () => bot.refreshToken() },
    { label: 'Очистить логи', action: () => bot.clearLogs() }
];
