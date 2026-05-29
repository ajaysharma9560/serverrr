const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { cors: { origin: "*" } });

let latestFrame = null;

// Simple control page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Camera Control</title>
        <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
        <style>
            body { background: #0f172a; color: white; text-align: center; padding: 50px; font-family: system-ui; }
            button { padding: 12px 24px; margin: 10px; border: none; border-radius: 8px; cursor: pointer; }
            .start { background: #22c55e; color: white; }
            .stop { background: #ef4444; color: white; }
            .status { margin: 20px; font-size: 18px; }
            .online { color: #22c55e; }
            .offline { color: #ef4444; }
        </style>
    </head>
    <body>
        <h1>📷 Camera Controller</h1>
        <div id="status" class="offline">● Offline</div>
        <button class="start" onclick="send('start')">▶ START</button>
        <button class="stop" onclick="send('stop')">⏹ STOP</button>
        <p>📺 Vercel Viewer: <a href="#" id="vercelLink" target="_blank">Open</a></p>
        <script>
            const socket = io();
            function send(cmd) { socket.emit('command', cmd); }
            socket.on('connect', () => {
                document.getElementById('status').innerHTML = '● Online';
                document.getElementById('status').className = 'online';
            });
        </script>
    </body>
    </html>
  `);
});

// Simple frame forward endpoint
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('frame', (data) => {
    io.emit('frame', data);
  });
  
  socket.on('command', (cmd) => {
    console.log('Command:', cmd);
    io.emit('command', cmd);
  });
});

server.listen(3000, () => console.log('✅ Server running'));
