// server.js
const express = require('express');
const http    = require('http');
const path    = require('path');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// Serve tudo dentro de public/
app.use(express.static(path.join(__dirname, 'public')));

// Fila de espera e salas
let waitingPlayer = null;
const rooms = {}; // Cria as salas (Player A e B)

io.on('connection', socket => {
  // armazenamos o nome para usar no chat
  socket.data.name = socket.id; // default (vai ser sobrescrito em joinQueue)

  socket.on('joinQueue', ({ name }) => {
    socket.data.name = name;
    if (!waitingPlayer) {
      waitingPlayer = socket;
      socket.emit('queueStatus', { waiting: true });
    } else {
      const a = waitingPlayer, b = socket;
      waitingPlayer = null;
      const roomId = `room-${a.id}-${b.id}`;
      a.join(roomId);
      b.join(roomId);
      rooms[roomId] = { players: [a.id, b.id], rematch: new Set() };

      const aIsX = Math.random() < 0.5;
      a.data.symbol = aIsX ? 'X' : 'O';
      b.data.symbol = aIsX ? 'O' : 'X';

      [a, b].forEach(s => {
        s.emit('startGame', {
          roomId,
          symbol:   s.data.symbol,
          opponent: s === a ? b.data.name : a.data.name
        });
      });
    }
  });

  socket.on('playMove', ({ roomId, index }) => {
    io.to(roomId).emit('movePlayed', {
      index,
      player: socket.data.symbol
    });
  });

  socket.on('rematchRequest', ({ roomId }) => {
    const R = rooms[roomId];
    if (!R) return;
    R.rematch.add(socket.id);
    if (R.rematch.size === 2) {
      R.rematch.clear();
      const [idA, idB] = R.players;
      const sA = io.sockets.sockets.get(idA);
      const sB = io.sockets.sockets.get(idB);
      [sA.data.symbol, sB.data.symbol] = [sB.data.symbol, sA.data.symbol];
      io.to(roomId).emit('rematchStart');
    }
  });

  // Chat
  socket.on('sendMessage', ({ roomId, text }) => {
    
    io.to(roomId).emit('receiveMessage', {
      from: socket.data.name,
      text
    });
  });

  socket.on('disconnect', () => {
    if (waitingPlayer === socket) waitingPlayer = null;
  });
});

server.listen(3000, () => console.log('Servidor em http://localhost:3000'));
