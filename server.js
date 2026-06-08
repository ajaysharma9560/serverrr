const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" },
  transports: ['websocket', 'polling']
});

app.use(cors());

let devices = [];

// ✅ SIMPLE LOGIC
io.on('connection', (socket) => {
  console.log('🔌 Client:', socket.id);
  
  // Android se register
  socket.on('register', (data) => {
    devices.push({
      id: socket.id,
      name: data.name || 'Phone',
      online: true
    });
    console.log('✅ Device added:', data.name);
    console.log('📊 Total:', devices.length);
    
    // ✅ BROADCAST to ALL clients (Web panel ko bhi)
    io.emit('update', devices);
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    devices = devices.filter(d => d.id !== socket.id);
    console.log('❌ Device removed');
    console.log('📊 Total:', devices.length);
    
    // ✅ BROADCAST again
    io.emit('update', devices);
  });
  
  // ✅ Jab web panel connect ho, turant bhejo
  socket.emit('update', devices);
});

// Web page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Ludoo Test</title>
    <style>
        body { background: #000; color: white; font-family: Arial; padding: 20px; }
        .device { background: #222; padding: 10px; margin: 5px; border-radius: 10px; }
        .online { color: #0f0; }
    </style>
</head>
<body>
    <h1>📹 Connected Devices</h1>
    <div id="list">Waiting...</div>
    <div id="status">Status: Connecting...</div>
    
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const listDiv = document.getElementById('list');
        const statusDiv = document.getElementById('status');
        
        socket.on('connect', () => {
            statusDiv.innerHTML = 'Status: ✅ Connected';
            statusDiv.style.color = '#0f0';
        });
        
        socket.on('update', (devices) => {
            console.log('Devices:', devices);
            if(devices.length === 0) {
                listDiv.innerHTML = '<div>No devices connected</div>';
            } else {
                listDiv.innerHTML = devices.map(d => 
                    '<div class="device">📱 ' + d.name + ' <span class="online">● ONLINE</span></div>'
                ).join('');
            }
        });
        
        // Check connection every 2 seconds
        setInterval(() => {
            if(!socket.connected) {
                statusDiv.innerHTML = 'Status: ❌ Disconnected';
                statusDiv.style.color = '#f00';
            }
        }, 2000);
    </script>
</body>
</html>
  `);
});

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════╗
║  🚀 SERVER READY       ║
║  PORT: ${PORT}              ║
║  URL: http://0.0.0.0:${PORT} ║
╚════════════════════════╝
  `);
});
