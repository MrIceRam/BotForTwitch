const fs = require('fs');
const axios = require('axios');

function updateEnvValue(key, newValue) {
    try {
        // Читаем текущее содержимое .env файла
        let envContent = fs.readFileSync('.env', 'utf8');

        // Создаем регулярное выражение для поиска строки с ключом
        const regex = new RegExp(`^${key}=.*$`, 'm');

        // Заменяем значение
        const newEnvContent = envContent.replace(regex, `${key}=${newValue}`);

        // Записываем обновленное содержимое обратно в файл
        fs.writeFileSync('.env', newEnvContent);

        // Обновляем переменные окружения в текущем процессе
        process.env[key] = newValue;

        console.log(`Updated ${key} in .env file`);
    } catch (error) {
        console.error(`Error updating .env file: ${error.message}`);
    }
}

async function refreshAllTokens() {
    try {
        let twitchchannelToken;

        if(process.env.REFRESH) {
            let refrashtoken = process.env.REFRESH;
            twitchchannelToken = await refrashtokens(refrashtoken);
            console.log('Channel token refreshed:', twitchchannelToken);
        }
        if(process.env.REFRESH && twitchchannelToken) {
            await updateEnvValue('OAUTH', twitchchannelToken);
        }

        return true;
    } catch (error) {
        console.log('Error refreshing tokens. USE OLD TOKENS')
        return true;
    }
}

async function refrashtokens(refrashtoken) {
    try {
        const url = `https://twitchtokengenerator.com/api/refresh/${refrashtoken}`;
        // Опция timeout задаётся в миллисекундах (10000 = 10 секунд)
        const response = await axios.get(url, { timeout: 10000 });
        if(refrashtoken === process.env.REFRESH){
            console.log(`Восстановление ${process.env.OAUTH} :`, response.data)
            return response.data.token
        }
    } catch (error) {
        // Если ошибка связана с таймаутом или другим исключением, выводим сообщение и продолжаем
        console.error('Запрос к API не выполнен или превысил 10 секунд:', error.message);
        throw error; // Re-throw the error to handle it in the calling function
    }
}

module.exports = { updateEnvValue, refreshAllTokens, refrashtokens };