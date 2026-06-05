const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Store data
let latestFrame = null;
let connectedDevices = [];

// 📱 Socket.IO Connection
io.on('connection', (socket) => {
  console.log('📱 Device connected:', socket.id);
  
  // Register device
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || data.model || "Unknown Device",
      model: data.model || "Unknown",
      androidVersion: data.androidVersion || "Unknown",
      connectedAt: new Date().toISOString()
    };
    
    // Check if device already exists
    const existingIndex = connectedDevices.findIndex(d => d.id === socket.id);
    if (existingIndex >= 0) {
      connectedDevices[existingIndex] = device;
    } else {
      connectedDevices.push(device);
    }
    
    console.log(`✅ Device registered: ${device.name}`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    
    // ✅ Broadcast updated device list to ALL clients
    io.emit('devices_list', connectedDevices);
  });
  
  // Receive frame
  socket.on('stream_frame', (data) => {
    if (data && data.image) {
      latestFrame = data.image;
      // Broadcast to web clients
      io.emit('new_frame', { image: data.image });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('📱 Device disconnected:', socket.id);
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    console.log(`📊 Remaining devices: ${connectedDevices.length}`);
    
    // ✅ Broadcast updated device list
    io.emit('devices_list', connectedDevices);
  });
  
  // Send current device list to newly connected client
  socket.emit('devices_list', connectedDevices);
});

// 🌐 Web Interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ludoo Camera Controller</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            .container { max-width: 1200px; margin: 0 auto; }
            .header {
                background: white;
                border-radius: 15px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            .header h1 { color: #333; margin-bottom: 10px; }
            .device-info {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
                margin-top: 10px;
            }
            .device-card {
                background: #f0f0f0;
                padding: 10px 15px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .status-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #4CAF50;
                animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            .main-grid {
                display: grid;
                grid-template-columns: 1fr 300px;
                gap: 20px;
            }
            .video-section {
                background: black;
                border-radius: 15px;
                overflow: hidden;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            .video-container {
                position: relative;
                background: #000;
                min-height: 400px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #videoStream {
                width: 100%;
                max-height: 70vh;
                object-fit: contain;
            }
            .stream-status {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 5px;
                font-size: 12px;
            }
            .controls-section {
                background: white;
                border-radius: 15px;
                padding: 20px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            .btn {
                width: 100%;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                margin-bottom: 10px;
                transition: all 0.3s;
            }
            .btn-start { background: #4CAF50; color: white; }
            .btn-stop { background: #f44336; color: white; }
            .btn-flip { background: #2196F3; color: white; }
            .control-group { margin-bottom: 20px; }
            .control-group label {
                display: block;
                margin-bottom: 8px;
                color: #333;
                font-weight: 500;
            }
            .devices-list {
                margin-top: 20px;
                background: white;
                border-radius: 15px;
                padding: 15px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            .devices-list h3 { margin-bottom: 15px; color: #333; }
            .device-item {
                padding: 10px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .device-name { font-weight: 500; }
            .device-status { font-size: 12px; color: #4CAF50; }
            @media (max-width: 768px) {
                .main-grid { grid-template-columns: 1fr; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Camera Controller</h1>
                <div class="device-info">
                    <div class="device-card">
                        <div class="status-dot"></div>
                        <span id="serverStatus">Server Online</span>
                    </div>
                    <div class="device-card">
                        📱 <span id="deviceCount">0</span> Device(s) Connected
                    </div>
                </div>
            </div>
            
            <div class="main-grid">
                <div class="video-section">
                    <div class="video-container">
                        <img id="videoStream" src="" alt="Live stream">
                        <div class="stream-status" id="streamStatus">🔴 No active stream</div>
                    </div>
                </div>
                
                <div class="controls-section">
                    <div class="control-group">
                        <label>🎮 Camera Controls</label>
                        <button class="btn btn-start" id="startBtn">▶ START</button>
                        <button class="btn btn-stop" id="stopBtn">⏹ STOP</button>
                        <button class="btn btn-flip" id="flipBtn">🔄 FLIP</button>
                    </div>
                </div>
            </div>
            
            <div class="devices-list">
                <h3>📱 Connected Devices</h3>
                <div id="devicesContainer">
                    <div style="text-align: center; color: #999;">Waiting for devices...</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            
            // DOM elements
            const videoStream = document.getElementById('videoStream');
            const streamStatus = document.getElementById('streamStatus');
            const deviceCountSpan = document.getElementById('deviceCount');
            const devicesContainer = document.getElementById('devicesContainer');
            
            // Socket events
            socket.on('connect', () => {
                console.log('Connected to server');
                document.getElementById('serverStatus').innerHTML = '● Online';
            });
            
            socket.on('new_frame', (data) => {
                if (data && data.image) {
                    videoStream.src = 'data:image/jpeg;base64,' + data.image;
                    streamStatus.innerHTML = '✅ LIVE STREAMING';
                    streamStatus.style.background = 'rgba(76, 175, 80, 0.9)';
                }
            });
            
            socket.on('devices_list', (devices) => {
                console.log('Devices updated:', devices);
                deviceCountSpan.textContent = devices.length;
                
                if (devices.length === 0) {
                    devicesContainer.innerHTML = '<div style="text-align: center; color: #999;">No devices connected</div>';
                } else {
                    devicesContainer.innerHTML = devices.map(device => `
                        <div class="device-item">
                            <div>
                                <div class="device-name">📱 ${device.name}</div>
                                <div style="font-size: 11px; color: #999;">${device.model} | ${device.androidVersion}</div>
                            </div>
                            <div class="device-status">● Online</div>
                        </div>
                    `).join('');
                }
            });
            
            // Send commands
            function sendCommand(command) {
                socket.emit('command', { command });
                console.log('Command sent:', command);
            }
            
            document.getElementById('startBtn').onclick = () => sendCommand('start');
            document.getElementById('stopBtn').onclick = () => sendCommand('stop');
            document.getElementById('flipBtn').onclick = () => sendCommand('flip');
        </script>
    </body>
    </html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devices: connectedDevices.length,
    hasFrame: latestFrame !== null,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ Ludoo Camera Server Started');
  console.log('═══════════════════════════════════════');
  console.log(`🌐 Web: http://localhost:${PORT}`);
  console.log(`💪 Health: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════');
});
