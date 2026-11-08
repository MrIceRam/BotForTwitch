const MASTER_SERVERS = [
  'https://master1.ddnet.org/ddnet/15/servers.json',
  'https://master2.ddnet.org/ddnet/15/servers.json',
  'https://master3.ddnet.org/ddnet/15/servers.json',
  'https://master4.ddnet.org/ddnet/15/servers.json'
];

let lastWorkingServer = null;

async function tryFetchFromServer(url) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3' };
  const timeout = 5000; // 10 seconds timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`Отправляем запрос к серверу: ${url}`);
    const response = await fetch(url, { 
      headers,
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`Успешно получили данные с сервера: ${url}`);
    lastWorkingServer = url; // Cache the working server
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`Превышено время ожидания для сервера ${url}`);
    } else {
      console.error(`Ошибка при получении данных с сервера ${url}:`, error.message);
    }
    return null;
  }
}

async function findPlayerAndMap(playerName) {
  // Try the last working server first if available
  if (lastWorkingServer) {
    console.log(`Пробуем последний рабочий сервер: ${lastWorkingServer}`);
    const data = await tryFetchFromServer(lastWorkingServer);
    if (data) {
      return processServerData(data, playerName);
    }
  }

  // If last working server failed or not available, try all servers in sequence
  for (const serverUrl of MASTER_SERVERS) {
    console.log(`Пробуем подключиться к серверу: ${serverUrl}`);
    const data = await tryFetchFromServer(serverUrl);
    if (data) {
      return processServerData(data, playerName);
    }
  }

  return `Не удалось подключиться ни к одному серверу для поиска игрока ${playerName}`;
}

function processServerData(data, playerName) {
  const foundPlayers = [];
  
  // Level 1: Exact match across all servers
  for (const server of data.servers) {
    if (server.info.clients) {
      for (const client of server.info.clients) {
        if (client.name === playerName) {
          const serverAddress = server.addresses[0];
          const cleanAddress = serverAddress.replace(/^tw-0\.6\+udp:\/\//, '');
          foundPlayers.push({
            name: client.name,
            ip: cleanAddress,
            map: server.info.map.name,
            gameType: server.info.game_type
          });
        }
      }
    }
  }

  // Level 2: Case-insensitive match across all servers
  for (const server of data.servers) {
    if (server.info.clients) {
      for (const client of server.info.clients) {
        if (client.name.toLowerCase() === playerName.toLowerCase() && 
            !foundPlayers.some(p => p.name === client.name)) {
          const serverAddress = server.addresses[0];
          const cleanAddress = serverAddress.replace(/^tw-0\.6\+udp:\/\//, '');
          foundPlayers.push({
            name: client.name,
            ip: cleanAddress,
            map: server.info.map.name,
            gameType: server.info.game_type
          });
        }
      }
    }
  }

  // Level 3: Partial match across all servers
  for (const server of data.servers) {
    if (server.info.clients) {
      for (const client of server.info.clients) {
        if (client.name.toLowerCase().includes(playerName.toLowerCase()) && 
            !foundPlayers.some(p => p.name === client.name)) {
          const serverAddress = server.addresses[0];
          const cleanAddress = serverAddress.replace(/^tw-0\.6\+udp:\/\//, '');
          foundPlayers.push({
            name: client.name,
            ip: cleanAddress,
            map: server.info.map.name,
            gameType: server.info.game_type
          });
        }
      }
    }
  }
  if (foundPlayers.length === 0) {
    return `Игрок ${playerName} не найден ни на одном сервере`;
  }
  return foundPlayers;
}

module.exports = { processServerData, findPlayerAndMap};