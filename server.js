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
let currentSettings = {
  fps: 30,
  resolution: "640x480",
  quality: 70,
  flip: false
};

// 📱 Socket.IO Connection
io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  // Register device from Android app
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || data.model || "Android Device",
      model: data.model || "Unknown",
      androidVersion: data.androidVersion || "Unknown",
      connectedAt: new Date().toISOString()
    };
    
    // Check if already exists
    const existingIndex = connectedDevices.findIndex(d => d.id === socket.id);
    if (existingIndex >= 0) {
      connectedDevices[existingIndex] = device;
    } else {
      connectedDevices.push(device);
    }
    
    console.log(`✅ Device registered: ${device.name}`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    
    // Send current settings to new device
    socket.emit('settings_update', currentSettings);
    
    // Broadcast updated device list to all clients
    io.emit('devices_list', connectedDevices);
  });
  
  // Receive frame from Android
  socket.on('stream_frame', (data) => {
    if (data && data.image) {
      latestFrame = data.image;
      // Broadcast to ALL web clients
      io.emit('new_frame', { 
        image: data.image,
        timestamp: Date.now(),
        settings: currentSettings
      });
    }
  });
  
  // Receive command from web panel
  socket.on('command', (data) => {
    console.log('📡 Command received:', data.command, data.value || '');
    
    // Forward command to Android device
    if (data.deviceId) {
      io.to(data.deviceId).emit('command', data);
    } else {
      io.emit('command', data);
    }
    
    // Update local settings
    if (data.command === 'quality' && data.value) {
      currentSettings.quality = data.value;
    } else if (data.command === 'resolution' && data.value) {
      currentSettings.resolution = data.value;
    } else if (data.command === 'fps' && data.value) {
      currentSettings.fps = data.value;
    } else if (data.command === 'flip') {
      currentSettings.flip = !currentSettings.flip;
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    io.emit('devices_list', connectedDevices);
  });
  
  // Send current device list to new client
  socket.emit('devices_list', connectedDevices);
});

// 🌐 Web Interface - Complete Camera Controller
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
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 1400px;
                margin: 0 auto;
            }
            
            /* Header */
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 20px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                color: white;
            }
            
            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
            }
            
            .header p {
                opacity: 0.9;
                font-size: 14px;
            }
            
            .device-info {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
                margin-top: 15px;
            }
            
            .info-card {
                background: rgba(255,255,255,0.2);
                padding: 10px 20px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                backdrop-filter: blur(10px);
            }
            
            .status-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #4CAF50;
                animation: pulse 1.5s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            /* Main Grid */
            .main-grid {
                display: grid;
                grid-template-columns: 1fr 320px;
                gap: 20px;
            }
            
            /* Video Section */
            .video-section {
                background: #000;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            
            .video-container {
                position: relative;
                background: #000;
                min-height: 500px;
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
                top: 15px;
                left: 15px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                backdrop-filter: blur(5px);
            }
            
            .stream-status.active {
                background: rgba(76, 175, 80, 0.9);
            }
            
            .stream-info {
                position: absolute;
                bottom: 15px;
                right: 15px;
                background: rgba(0,0,0,0.7);
                color: #888;
                padding: 5px 10px;
                border-radius: 10px;
                font-size: 11px;
                font-family: monospace;
            }
            
            /* Controls Section */
            .controls-section {
                background: white;
                border-radius: 20px;
                padding: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            
            .control-group {
                margin-bottom: 25px;
            }
            
            .control-group label {
                display: block;
                margin-bottom: 10px;
                color: #333;
                font-weight: 600;
                font-size: 14px;
            }
            
            /* Buttons */
            .btn-group {
                display: flex;
                gap: 10px;
            }
            
            .btn {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .btn-start {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
            }
            
            .btn-stop {
                background: linear-gradient(135deg, #f44336, #da190b);
                color: white;
            }
            
            .btn-flip {
                background: linear-gradient(135deg, #2196F3, #0b7dda);
                color: white;
            }
            
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            
            /* Resolution Grid */
            .resolution-grid, .quality-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
            }
            
            .res-btn, .quality-btn {
                padding: 10px;
                border: 2px solid #e0e0e0;
                background: #f5f5f5;
                border-radius: 10px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: all 0.3s;
                text-align: center;
            }
            
            .res-btn.active, .quality-btn.active {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border-color: #667eea;
            }
            
            /* FPS Slider */
            .fps-slider {
                width: 100%;
                margin: 10px 0;
            }
            
            .fps-value {
                text-align: center;
                font-size: 14px;
                color: #666;
                margin-top: 5px;
            }
            
            /* Device List */
            .devices-section {
                margin-top: 20px;
                background: white;
                border-radius: 20px;
                padding: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            
            .devices-section h3 {
                margin-bottom: 15px;
                color: #333;
                font-size: 18px;
            }
            
            .devices-list {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .device-item {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 12px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: all 0.3s;
            }
            
            .device-item:hover {
                background: #e9ecef;
            }
            
            .device-name {
                font-weight: 600;
                color: #333;
            }
            
            .device-model {
                font-size: 11px;
                color: #888;
                margin-top: 3px;
            }
            
            .device-status {
                font-size: 12px;
                color: #4CAF50;
                font-weight: 500;
            }
            
            .device-status.offline {
                color: #f44336;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .main-grid {
                    grid-template-columns: 1fr;
                }
            }
            
            /* Scrollbar */
            .devices-list::-webkit-scrollbar {
                width: 6px;
            }
            
            .devices-list::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 10px;
            }
            
            .devices-list::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Camera Controller</h1>
                <p>Live stream from your device</p>
                <div class="device-info">
                    <div class="info-card">
                        <div class="status-dot"></div>
                        <span id="serverStatus">Server Online</span>
                    </div>
                    <div class="info-card">
                        📱 <span id="deviceCount">0</span> Device(s) Connected
                    </div>
                    <div class="info-card">
                        🎬 <span id="fpsDisplay">0</span> FPS
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
                        <div class="stream-info" id="streamInfo">
                            640x480 | 30 FPS
                        </div>
                    </div>
                </div>
                
                <div class="controls-section">
                    <div class="control-group">
                        <label>🎮 Camera Controls</label>
                        <div class="btn-group">
                            <button class="btn btn-start" id="startBtn">▶ START</button>
                            <button class="btn btn-stop" id="stopBtn">⏹ STOP</button>
                            <button class="btn btn-flip" id="flipBtn">🔄 FLIP</button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label>📐 Resolution</label>
                        <div class="resolution-grid">
                            <button class="res-btn" data-res="160x120">120p</button>
                            <button class="res-btn" data-res="176x144">140p</button>
                            <button class="res-btn" data-res="320x240">240p</button>
                            <button class="res-btn" data-res="480x360">360p</button>
                            <button class="res-btn active" data-res="640x480">480p</button>
                            <button class="res-btn" data-res="1280x720">720p</button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label>🎨 Quality</label>
                        <div class="quality-grid">
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
            
            <div class="devices-section">
                <h3>📱 Connected Devices</h3>
                <div class="devices-list" id="devicesContainer">
                    <div style="text-align: center; color: #999; padding: 20px;">No devices connected</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            let frameCount = 0;
            let lastFpsUpdate = Date.now();
            
            // DOM Elements
            const videoStream = document.getElementById('videoStream');
            const streamStatus = document.getElementById('streamStatus');
            const deviceCountSpan = document.getElementById('deviceCount');
            const devicesContainer = document.getElementById('devicesContainer');
            const fpsDisplay = document.getElementById('fpsDisplay');
            const streamInfo = document.getElementById('streamInfo');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsValue = document.getElementById('fpsValue');
            
            // Socket Events
            socket.on('connect', () => {
                console.log('Connected to server');
                document.getElementById('serverStatus').innerHTML = '● Server Online';
            });
            
            socket.on('new_frame', (data) => {
                if (data && data.image) {
                    videoStream.src = 'data:image/jpeg;base64,' + data.image;
                    streamStatus.innerHTML = '✅ LIVE STREAMING';
                    streamStatus.classList.add('active');
                    
                    // Calculate FPS
                    frameCount++;
                    const now = Date.now();
                    if (now - lastFpsUpdate >= 1000) {
                        const fps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
                        fpsDisplay.textContent = fps;
                        frameCount = 0;
                        lastFpsUpdate = now;
                    }
                    
                    // Update stream info
                    if (data.settings) {
                        streamInfo.textContent = data.settings.resolution + ' | ' + data.settings.fps + ' FPS';
                    }
                }
            });
            
            socket.on('devices_list', (devices) => {
                deviceCountSpan.textContent = devices.length;
                
                if (devices.length === 0) {
                    devicesContainer.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No devices connected</div>';
                } else {
                    devicesContainer.innerHTML = devices.map(device => `
                        <div class="device-item">
                            <div>
                                <div class="device-name">📱 ${device.name}</div>
                                <div class="device-model">${device.model} | ${device.androidVersion}</div>
                            </div>
                            <div class="device-status">● Online</div>
                        </div>
                    `).join('');
                }
            });
            
            // Send command function
            function sendCommand(command, value = null) {
                const data = { command };
                if (value !== null) {
                    data.value = value;
                }
                socket.emit('command', data);
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
            fpsSlider.oninput = () => {
                const fps = parseInt(fpsSlider.value);
                fpsValue.textContent = fps + ' FPS';
                sendCommand('fps', fps);
            };
            
            // Update FPS display on slider change
            fpsSlider.onchange = () => {
                const fps = parseInt(fpsSlider.value);
                sendCommand('fps', fps);
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
    settings: currentSettings,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Ludoo Camera Controller Server Started');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
  console.log(`💪 Health Check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('📱 Features Available:');
  console.log('   ▶ Start/Stop Streaming');
  console.log('   🔄 Flip Camera (Front/Back)');
  console.log('   📐 Resolutions: 120p, 140p, 240p, 360p, 480p, 720p');
  console.log('   🎨 Quality: Low, Medium, High');
  console.log('   ⚡ FPS Control: 5-60 FPS');
  console.log('   📱 Device Panel with connected devices');
  console.log('');
  console.log('📡 Waiting for Android device to connect...');
  console.log('');
});
