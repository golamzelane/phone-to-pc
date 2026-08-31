const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

const activeSessions = new Map();

io.on('connection', (socket) => {
  socket.on('create-session', (sessionId) => {
    socket.join(sessionId);
    const expireTime = Date.now() + 10 * 60 * 1000;
    activeSessions.set(sessionId, { host: socket.id, expireTime });

    setTimeout(() => {
      io.to(sessionId).emit('session-expired');
      activeSessions.delete(sessionId);
    }, 10 * 60 * 1000);
  });

  socket.on('join-session', (sessionId) => {
    const session = activeSessions.get(sessionId);
    if (session && Date.now() < session.expireTime) {
      socket.join(sessionId);
      socket.to(session.host).emit('client-connected');
    } else {
      socket.emit('invalid-session');
    }
  });

  socket.on('signal', ({ sessionId, data }) => {
    socket.to(sessionId).emit('signal', data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));