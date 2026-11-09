# BotForTwitch

Twitch-бот для стримов [MrIceRam](https://twitch.tv/MrIceRam) по [DDNet](https://ddnet.org).
Показывает чат Twitch прямо в игре, инвайтит зрителей, ищет игроков на серверах
и за баллы канала переворачивает управление у стримера.

## Команды

| Команда | Что делает |
|---|---|
| `!invite <ник>` | Инвайтит игрока в команду в DDNet |
| `!points <ник>` | Очки игрока с ddnet.org |
| `!map [ник]` | На какой карте и сервере сейчас игрок (без ника — `IceRam`) |
| `!roll` | Случайное число от 0 до 100 |

А ещё бот:
- пересылает все сообщения из чата в консоль DDNet;
- отвечает на некоторые фразы (список в `src/commands/answer.js`);
- каждые 5 минут пишет рекламу стрима в чат DDNet.

## Что нужно

- Windows
- [Node.js](https://nodejs.org) 18+
- [Python](https://www.python.org) 3
- Клиент DDNet

## Установка

```bash
npm install
pip install -r requirements.txt
```

Файл `.env` заполняется сам. Запустите:

```bash
npm run setup
```

Откроется браузер ([twitchtokengenerator.com](https://twitchtokengenerator.com)) — войдите аккаунтом канала
и нажмите «Authorize». Бот сам запишет в `.env` `TWITCHUSER`, `OAUTH`, `CLIEN` и `REFRESH`.
Если `.env` нет, то же самое произойдёт при `npm start`.
При каждом запуске бот сам обновляет `OAUTH`.

> [!WARNING]
> Не выкладывайте `.env` — в нём доступ к каналу. Он уже в `.gitignore`.

В консоли DDNet (F1) один раз выполните и перезапустите клиент:

```
cl_input_fifo ddnet_client
```

## Запуск

Запустите DDNet, зайдите на сервер, затем:

```bash
npm start
```

## Награда «реверс»

За награду с баллами канала на 30 секунд меняются местами `A`↔`D`, `W`↔`S` и кнопки мыши.

- id награды прописан в `src/index.js` (`onReward`). Свой id бот пишет в консоль при погашении награды.
- Остановить досрочно: `"unblock": "True"` в `config/blocking.json` (потом верните `"False"`).
- Если в игре не работает — запустите бота от имени администратора.

## Структура

```
src/
  index.js          точка входа
  commands/         команды чата (answer, ddmap, bounty)
  services/         обновление токена (tokens.js)
python/             скрипты: связь с DDNet, очки, реверс
config/             blocking.json — настройки реверса
```

## Авторы

[MrIceRam](https://github.com/MrIceRam), [1Voix1](https://github.com/1Voix1)
