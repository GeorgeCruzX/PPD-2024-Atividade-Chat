// server.js
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Criar servidor HTTP para servir arquivos estáticos
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(500);
            res.end('Error loading ' + filePath);
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Criar servidor WebSocket
const wss = new WebSocket.Server({ server });

// Gerenciar salas de chat
const chatRooms = new Map();

// Estrutura para armazenar conexões e suas salas
const clientRooms = new Map();

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch(data.type) {
            case 'join':
                handleJoinRoom(ws, data.room);
                break;
            case 'message':
                handleMessage(ws, data);
                break;
            case 'leave':
                handleLeaveRoom(ws);
                break;
        }
    });

    ws.on('close', () => {
        handleLeaveRoom(ws);
    });
});

function handleJoinRoom(ws, roomName) {
    // Sair da sala atual se estiver em alguma
    if (clientRooms.has(ws)) {
        handleLeaveRoom(ws);
    }

    // Criar sala se não existir
    if (!chatRooms.has(roomName)) {
        chatRooms.set(roomName, new Set());
    }

    // Adicionar cliente à sala
    chatRooms.get(roomName).add(ws);
    clientRooms.set(ws, roomName);

    // Notificar entrada na sala
    const message = {
        type: 'system',
        room: roomName,
        content: 'New user joined the room'
    };

    broadcastToRoom(roomName, message);
}

function handleLeaveRoom(ws) {
    const roomName = clientRooms.get(ws);
    if (roomName) {
        const room = chatRooms.get(roomName);
        if (room) {
            room.delete(ws);
            
            // Remover sala se estiver vazia
            if (room.size === 0) {
                chatRooms.delete(roomName);
            } else {
                // Notificar saída da sala
                const message = {
                    type: 'system',
                    room: roomName,
                    content: 'User left the room'
                };
                broadcastToRoom(roomName, message);
            }
        }
        clientRooms.delete(ws);
    }
}

function handleMessage(ws, data) {
    const roomName = clientRooms.get(ws);
    if (roomName) {
        broadcastToRoom(roomName, {
            type: 'message',
            room: roomName,
            content: data.content
        });
    }
}

function broadcastToRoom(roomName, message) {
    const room = chatRooms.get(roomName);
    if (room) {
        const messageStr = JSON.stringify(message);
        room.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(messageStr);
            }
        });
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});