const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', (ws) => {
    console.log("Новое подключение");

    ws.on('message', (message) => {
        console.log("Получено сообщение:", message);

        // Рассылаем сообщение всем подключенным клиентам
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log("Клиент отключен");
    });
});

console.log("Сигнализационный сервер запущен на порту 3000");
