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
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Store latest frame and device info
let latestFrame = null;
let connectedDevices = [];
let streamSettings = {
  fps: 30,
  resolution: "640x480",
  quality: 70,
  flip: false
};

// 📱 Socket.IO Connection
io.on('connection', (socket) => {
  console.log('📱 Device connected:', socket.id);
  
  // Register device with name
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName,
      model: data.model,
      androidVersion: data.androidVersion,
      connectedAt: new Date().toISOString()
    };
    connectedDevices.push(device);
    console.log(`✅ Device registered: ${device.name} (${device.model})`);
    
    // Send current settings to device
    socket.emit('settings_update', streamSettings);
    
    // Broadcast updated device list
    io.emit('devices_list', connectedDevices);
  });
  
  // Receive frame from Android
  socket.on('stream_frame', (data) => {
    latestFrame = data.image;
    // Broadcast to all web clients
    io.emit('new_frame', { image: data.image });
  });
  
  // Receive settings change from Android
  socket.on('settings_changed', (data) => {
    streamSettings = { ...streamSettings, ...data };
    console.log('⚙️ Settings updated:', streamSettings);
    // Broadcast new settings to all
    io.emit('settings_update', streamSettings);
  });
  
  // Command from web to Android
  socket.on('command', (data) => {
    console.log('📡 Command received:', data.command);
    // Forward command to Android device
    if (data.deviceId) {
      io.to(data.deviceId).emit('command', data);
    } else {
      io.emit('command', data);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('📱 Device disconnected:', socket.id);
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    io.emit('devices_list', connectedDevices);
  });
});

// 🌐 Web Interface - Camera Controller
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Ludoo Camera Controller</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            
            /* Header */
            .header {
                background: white;
                border-radius: 15px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            
            .header h1 {
                color: #333;
                font-size: 24px;
                margin-bottom: 10px;
            }
            
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
            
            .device-card .status {
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
            
            /* Main Grid */
            .main-grid {
                display: grid;
                grid-template-columns: 1fr 300px;
                gap: 20px;
            }
            
            /* Video Section */
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
            
            .stream-status.active {
                background: rgba(76, 175, 80, 0.9);
            }
            
            /* Controls Section */
            .controls-section {
                background: white;
                border-radius: 15px;
                padding: 20px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            
            .control-group {
                margin-bottom: 20px;
            }
            
            .control-group label {
                display: block;
                margin-bottom: 8px;
                color: #333;
                font-weight: 500;
                font-size: 14px;
            }
            
            .control-group input, .control-group select {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
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
            
            .btn-start {
                background: #4CAF50;
                color: white;
            }
            
            .btn-start:hover {
                background: #45a049;
            }
            
            .btn-stop {
                background: #f44336;
                color: white;
            }
            
            .btn-stop:hover {
                background: #da190b;
            }
            
            .btn-flip {
                background: #2196F3;
                color: white;
            }
            
            .btn-flip:hover {
                background: #0b7dda;
            }
            
            .resolution-buttons, .quality-buttons {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-top: 8px;
            }
            
            .res-btn, .quality-btn {
                padding: 8px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.3s;
            }
            
            .res-btn.active, .quality-btn.active {
                background: #667eea;
                color: white;
                border-color: #667eea;
            }
            
            .fps-slider {
                width: 100%;
                margin: 10px 0;
            }
            
            .fps-value {
                text-align: center;
                font-size: 14px;
                color: #666;
            }
            
            /* Device List */
            .devices-list {
                margin-top: 20px;
                background: white;
                border-radius: 15px;
                padding: 15px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            
            .devices-list h3 {
                margin-bottom: 15px;
                color: #333;
            }
            
            .device-item {
                padding: 10px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .device-item:last-child {
                border-bottom: none;
            }
            
            .device-name {
                font-weight: 500;
            }
            
            .device-status {
                font-size: 12px;
                color: #4CAF50;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .main-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Camera Controller</h1>
                <div class="device-info">
                    <div class="device-card">
                        <div class="status"></div>
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
                        <img id="videoStream" src="" alt="Live stream from your device">
                        <div class="stream-status" id="streamStatus">
                            🔴 No active stream
                        </div>
                    </div>
                </div>
                
                <div class="controls-section">
                    <div class="control-group">
                        <label>🎮 Camera Controls</label>
                        <button class="btn btn-start" id="startBtn">▶ START</button>
                        <button class="btn btn-stop" id="stopBtn">⏹ STOP</button>
                        <button class="btn btn-flip" id="flipBtn">🔄 FLIP</button>
                    </div>
                    
                    <div class="control-group">
                        <label>📐 Resolution</label>
                        <div class="resolution-buttons">
                            <button class="res-btn" data-res="320x240">320x240</button>
                            <button class="res-btn" data-res="640x480">640x480</button>
                            <button class="res-btn" data-res="1280x720">1280x720</button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label>🎨 Quality</label>
                        <div class="quality-buttons">
                            <button class="quality-btn" data-quality="30">Low</button>
                            <button class="quality-btn active" data-quality="70">Medium</button>
                            <button class="quality-btn" data-quality="90">High</button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label>⚡ FPS (Frames Per Second)</label>
                        <input type="range" id="fpsSlider" min="5" max="60" value="30" class="fps-slider">
                        <div class="fps-value" id="fpsValue">30 FPS</div>
                    </div>
                </div>
            </div>
            
            <div class="devices-list">
                <h3>📱 Connected Devices</h3>
                <div id="devicesContainer">
                    <div style="text-align: center; color: #999;">No devices connected</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            let currentFrame = null;
            
            // DOM Elements
            const videoStream = document.getElementById('videoStream');
            const streamStatus = document.getElementById('streamStatus');
            const deviceCountSpan = document.getElementById('deviceCount');
            const devicesContainer = document.getElementById('devicesContainer');
            
            // Socket Events
            socket.on('connect', () => {
                console.log('Connected to server');
            });
            
            socket.on('new_frame', (data) => {
                if (data.image) {
                    videoStream.src = 'data:image/jpeg;base64,' + data.image;
                    streamStatus.innerHTML = '✅ LIVE STREAMING';
                    streamStatus.classList.add('active');
                }
            });
            
            socket.on('devices_list', (devices) => {
                deviceCountSpan.textContent = devices.length;
                if (devices.length === 0) {
                    devicesContainer.innerHTML = '<div style="text-align: center; color: #999;">No devices connected</div>';
                } else {
                    devicesContainer.innerHTML = devices.map(device => `
                        <div class="device-item">
                            <div>
                                <div class="device-name">📱 ${device.name}</div>
                                <div style="font-size: 11px; color: #999;">${device.model}</div>
                            </div>
                            <div class="device-status">● Online</div>
                        </div>
                    `).join('');
                }
            });
            
            // Send command to Android device
            function sendCommand(command, value = null) {
                socket.emit('command', { command, value });
                console.log('Command sent:', command, value);
            }
            
            // Button Events
            document.getElementById('startBtn').onclick = () => sendCommand('start');
            document.getElementById('stopBtn').onclick = () => sendCommand('stop');
            document.getElementById('flipBtn').onclick = () => sendCommand('flip');
            
            // Resolution buttons
            document.querySelectorAll('.res-btn').forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const resolution = btn.dataset.res;
                    sendCommand('resolution', resolution);
                };
            });
            
            // Quality buttons
            document.querySelectorAll('.quality-btn').forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const quality = parseInt(btn.dataset.quality);
                    sendCommand('quality', quality);
                };
            });
            
            // FPS Slider
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsValue = document.getElementById('fpsValue');
            fpsSlider.oninput = () => {
                const fps = fpsSlider.value;
                fpsValue.textContent = fps + ' FPS';
                sendCommand('fps', parseInt(fps));
            };
        </script>
    </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devices: connectedDevices.length,
    hasFrame: latestFrame !== null,
    settings: streamSettings
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ Ludoo Camera Controller Server Started');
  console.log('═══════════════════════════════════════');
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
  console.log(`💪 Health Check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('📱 Waiting for Android devices to connect...');
  console.log('');
});
