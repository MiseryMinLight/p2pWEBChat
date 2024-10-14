let ws;
let peerConnection;
let dataChannel;
const serverUrl = "ws://localhost:3000"; // URL WebSocket-сервера
const messagesDiv = document.getElementById("messages");
const statusDiv = document.getElementById("status");

// Флаг для отслеживания готовности DataChannel
let isDataChannelOpen = false;

function connect() {
    ws = new WebSocket(serverUrl);

    ws.onopen = () => {
        console.log("Подключено к сигнализационному серверу");
        statusDiv.innerText = "Статус: Подключено к серверу";
        createPeerConnection(true); // Инициируем P2P соединение
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleSignalingMessage(message);
        } catch (error) {
            console.error('Ошибка при разборе сообщения:', error);
        }
    };

    ws.onclose = () => {
        console.log("Сигнализационный сервер отключен");
        statusDiv.innerText = "Статус: Отключено от сервера, пытаюсь переподключиться...";
        setTimeout(connect, 3000); // Механизм реконнекта
    };
}

function handleSignalingMessage(message) {
    switch (message.type) {
        case "offer":
            createPeerConnection(false);
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
            peerConnection.createAnswer()
                .then(answer => {
                    peerConnection.setLocalDescription(answer);
                    ws.send(JSON.stringify({ type: "answer", answer: peerConnection.localDescription }));
                });
            break;

        case "answer":
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
            break;

        case "ice-candidate":
            peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
            break;

        default:
            console.warn('Неизвестный тип сообщения:', message.type);
            break;
    }
}

function createPeerConnection(isOffer) {
    peerConnection = new RTCPeerConnection();

    // Создаем DataChannel для отправки сообщений
    if (isOffer) {
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannel();
    }

    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }));
        }
    };

    if (isOffer) {
        peerConnection.createOffer()
            .then(offer => {
                peerConnection.setLocalDescription(offer);
                ws.send(JSON.stringify({ type: "offer", offer: peerConnection.localDescription }));
            });
    }
}

function setupDataChannel() {
    dataChannel.onopen = () => {
        console.log("DataChannel открыт!");
        statusDiv.innerText = "Статус: Соединение установлено";
        isDataChannelOpen = true; // Устанавливаем флаг, что DataChannel открыт
    };

    dataChannel.onmessage = (event) => {
        // Обработка текстовых сообщений и файлов
        if (event.data instanceof Blob) {
            const fileURL = URL.createObjectURL(event.data);
            messagesDiv.innerHTML += `<div><a href="${fileURL}" download>Получен файл</a></div>`;
        } else {
            const msg = event.data;
            messagesDiv.innerHTML += `<div>${msg}</div>`;
        }
        messagesDiv.scrollTop = messagesDiv.scrollHeight; // Прокрутка вниз
    };

    dataChannel.onclose = () => {
        console.log("DataChannel закрыт");
        statusDiv.innerText = "Статус: Соединение закрыто";
        isDataChannelOpen = false; // Сбрасываем флаг, когда DataChannel закрыт
    };
}

function sendMessage() {
    const messageInput = document.getElementById("messageInput");
    const message = messageInput.value;

    // Проверяем состояние DataChannel перед отправкой сообщения
    if (isDataChannelOpen) {
        dataChannel.send(message);
        console.log("Сообщение отправлено:", message);
        messagesDiv.innerHTML += `<div>${message}</div>`;
        messageInput.value = ""; // Очищаем поле ввода
    } else {
        console.warn("DataChannel не готов для отправки сообщений");
    }
}

function sendFile() {
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (isDataChannelOpen && file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const blob = new Blob([event.target.result]);
            dataChannel.send(blob); // Отправляем файл через DataChannel
            console.log("Файл отправлен:", file.name);
            messagesDiv.innerHTML += `<div>Отправлен файл: ${file.name}</div>`;
        };
        reader.readAsArrayBuffer(file);
        fileInput.value = ""; // Очищаем поле ввода файла
    } else {
        console.warn("DataChannel не готов для отправки файлов или файл не выбран");
    }
}

// Подключаемся к сигнализационному серверу при загрузке
connect();
