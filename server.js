const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Session Storage
const sessions = new Map();

io.on('connection', (socket) => {
  socket.on('create-session', (sessionId) => {
    sessions.set(sessionId, { host: socket.id, client: null, timer: null });
    socket.join(sessionId);

    // 10 minutes session limit
    const timer = setTimeout(() => {
      io.to(sessionId).emit('session-expired');
      sessions.delete(sessionId);
    }, 10 * 60 * 1000);

    sessions.get(sessionId).timer = timer;
  });

  socket.on('join-session', (sessionId) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.client = socket.id;
      socket.join(sessionId);
      io.to(session.host).emit('client-connected');
      socket.emit('session-joined');
    } else {
      socket.emit('invalid-session');
    }
  });

  socket.on('signal', ({ sessionId, data }) => {
    socket.to(sessionId).emit('signal', data);
  });

  socket.on('disconnect', () => {
    for (let [sessionId, session] of sessions.entries()) {
      if (session.host === socket.id || session.client === socket.id) {
        clearTimeout(session.timer);
        sessions.delete(sessionId);
        io.to(sessionId).emit('session-ended');
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});