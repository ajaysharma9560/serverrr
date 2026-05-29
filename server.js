const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

app.get('/', (req, res) => {
  res.send('Replit Stream Server Running');
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Forward frame to all clients
  socket.on('frame', (data) => {
    io.emit('frame', data);
  });
  
  // Forward commands to APK
  socket.on('command', (cmd) => {
    console.log('Command:', cmd);
    io.emit('command', cmd);
  });
  
  // Forward quality to APK
  socket.on('quality', (quality) => {
    console.log('Quality:', quality);
    io.emit('quality', quality);
  });
});

server.listen(3000, () => console.log('✅ Server running'));
