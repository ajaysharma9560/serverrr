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
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Store connected devices
let connectedDevices = [];
let currentFrame = null;

io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  // Register device from Android
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || "Android Device",
      model: data.model || "Unknown",
      cameraApi: data.cameraApi || "Camera2",
      qualities: data.qualities || "120,140,240,360",
      fpsOptions: data.fpsOptions || "5,10,15,20,25,30",
      currentFps: data.currentFps || 15,
      camera: data.camera || "back",
      status: data.status || "ready",
      connectedAt: new Date()
    };
    connectedDevices.push(device);
    console.log(`✅ Device registered: ${device.name}`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    
    io.emit('devices_list', connectedDevices);
  });
  
  // Receive stream_frame from Android
  socket.on('stream_frame', (data) => {
    if (data && data.image) {
      currentFrame = data.image;
      io.emit('new_frame', {
        image: data.image,
        timestamp: data.timestamp,
        quality: data.quality || 240,
        fps: data.fps || 15,
        camera: data.camera || 'back'
      });
    }
  });
  
  // Receive commands from web
  socket.on('command', (data) => {
    console.log(`📡 Command: ${data.command}, value: ${data.value || ''}`);
    
    // Broadcast to all connected Android devices
    connectedDevices.forEach(device => {
      io.to(device.id).emit('command', {
        command: data.command,
        value: data.value
      });
    });
  });
  
  socket.on('disconnect', () => {
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    io.emit('devices_list', connectedDevices);
    console.log('❌ Device disconnected');
    console.log(`📊 Remaining devices: ${connectedDevices.length}`);
  });
});

// Web Interface
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
            
            .status-value.online {
                color: #4CAF50;
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
            
            .stream-status {
                position: absolute;
                top: 15px;
                left: 15px;
                background: rgba(0,0,0,0.7);
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 11px;
                color: white;
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
            
            .btn-live.start {
                background: #4CAF50;
            }
            
            .btn-live.start:hover {
                background: #45a049;
            }
            
            .btn-live.stop {
                background: #f44336;
            }
            
            .btn-live.stop:hover {
                background: #da190b;
            }
            
            .btn-camera {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                background: #2196F3;
                color: white;
                transition: all 0.3s;
            }
            
            .btn-camera:hover {
                background: #0b7dda;
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
                animation: pulse 1.5s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .camera-badge {
                font-size: 11px;
                padding: 2px 8px;
                background: #0a0e27;
                border-radius: 12px;
                color: #6c7293;
            }
            
            @media (max-width: 768px) {
                .main-content {
                    grid-template-columns: 1fr;
                }
                
                .status-cards {
                    grid-template-columns: repeat(2, 1fr);
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
                <h1>Ludoo Camera Controller</h1>
                <p>Multi-Device Remote Camera Control</p>
            </div>
            
            <div class="status-cards">
                <div class="status-card">
                    <div class="status-label">STATUS</div>
                    <div class="status-value online" id="serverStatus">● Online</div>
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
                        <div id="noStream" class="stream-placeholder">
                            🔴 No active stream<br><span style="font-size: 12px;">Connect a device and press START</span>
                        </div>
                        <div class="stream-status" id="streamStatus">Waiting</div>
                    </div>
                </div>
                
                <div class="controls-section">
                    <div class="section-title">🎮 CONTROLS</div>
                    
                    <div class="live-controls">
                        <button class="btn-live start" id="startBtn">▶ START</button>
                        <button class="btn-live stop" id="stopBtn">⏹ STOP</button>
                        <button class="btn-camera" id="flipBtn">🔄 FLIP CAMERA</button>
                    </div>
                    
                    <div class="section-title">📐 QUALITY</div>
                    <div class="quality-options">
                        <button class="quality-btn" data-quality="120">120p</button>
                        <button class="quality-btn" data-quality="140">140p</button>
                        <button class="quality-btn active" data-quality="240">240p</button>
                        <button class="quality-btn" data-quality="360">360p</button>
                    </div>
                    
                    <div class="section-title">⚡ FPS CONTROL</div>
                    <div class="fps-control">
                        <div class="fps-label">
                            <span>Frames Per Second</span>
                            <span id="fpsValue">15</span>
                        </div>
                        <input type="range" id="fpsSlider" min="5" max="30" value="15" step="5" class="fps-slider">
                    </div>
                </div>
            </div>
            
            <div class="devices-section">
                <div class="device-header">
                    <h3>📱 CONNECTED DEVICES</h3>
                    <div class="device-count" id="deviceCountBadge">0</div>
                </div>
                <div class="devices-list" id="devicesContainer">
                    <div style="text-align: center; color: #6c7293; padding: 20px;">No devices connected</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            let frameCount = 0;
            let lastFpsUpdate = Date.now();
            
            const videoStream = document.getElementById('videoStream');
            const noStream = document.getElementById('noStream');
            const streamStatus = document.getElementById('streamStatus');
            const deviceCountSpan = document.getElementById('deviceCount');
            const deviceCountBadge = document.getElementById('deviceCountBadge');
            const devicesContainer = document.getElementById('devicesContainer');
            const fpsDisplay = document.getElementById('fpsDisplay');
            const qualityDisplay = document.getElementById('qualityDisplay');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsValue = document.getElementById('fpsValue');
            
            socket.on('connect', () => {
                console.log('Connected to server');
                streamStatus.innerHTML = 'Connected';
                streamStatus.style.background = '#4CAF50';
            });
            
            socket.on('disconnect', () => {
                streamStatus.innerHTML = 'Disconnected';
                streamStatus.style.background = '#f44336';
            });
            
            socket.on('new_frame', (data) => {
                if (data && data.image) {
                    videoStream.src = 'data:image/jpeg;base64,' + data.image;
                    videoStream.style.display = 'block';
                    noStream.style.display = 'none';
                    streamStatus.innerHTML = 'LIVE';
                    streamStatus.style.background = '#f44336';
                    
                    frameCount++;
                    const now = Date.now();
                    if (now - lastFpsUpdate >= 1000) {
                        fpsDisplay.textContent = frameCount;
                        qualityDisplay.textContent = (data.quality || 240) + 'p';
                        frameCount = 0;
                        lastFpsUpdate = now;
                    }
                }
            });
            
            socket.on('devices_list', (devices) => {
                deviceCountSpan.textContent = devices.length;
                deviceCountBadge.textContent = devices.length;
                
                if (devices.length === 0) {
                    devicesContainer.innerHTML = '<div style="text-align: center; color: #6c7293; padding: 20px;">No devices connected</div>';
                    videoStream.style.display = 'none';
                    noStream.style.display = 'block';
                    streamStatus.innerHTML = 'No device';
                    streamStatus.style.background = '#666';
                } else {
                    devicesContainer.innerHTML = devices.map(device => `
                        <div class="device-item">
                            <div class="device-info">
                                <span class="device-icon">📱</span>
                                <span class="device-name">${device.name}</span>
                                <div class="device-status"></div>
                            </div>
                            <div class="camera-badge">${device.camera || 'back'}</div>
                        </div>
                    `).join('');
                    streamStatus.innerHTML = 'Device ready';
                    streamStatus.style.background = '#ff9800';
                }
            });
            
            function sendCommand(command, value = null) {
                socket.emit('command', { command, value });
                console.log('Command sent:', command, value);
            }
            
            document.getElementById('startBtn').onclick = () => sendCommand('start');
            document.getElementById('stopBtn').onclick = () => sendCommand('stop');
            document.getElementById('flipBtn').onclick = () => sendCommand('flip');
            
            document.querySelectorAll('.quality-btn').forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const quality = parseInt(btn.dataset.quality);
                    qualityDisplay.textContent = quality + 'p';
                    sendCommand('quality', quality);
                };
            });
            
            fpsSlider.oninput = () => {
                const fps = parseInt(fpsSlider.value);
                fpsValue.textContent = fps;
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
    hasFrame: currentFrame !== null,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Ludoo Camera Controller Server Started');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
  console.log(`💪 Health Check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('📱 Features:');
  console.log('   • START / STOP streaming');
  console.log('   • FLIP camera (Front/Back)');
  console.log('   • 4 Quality options: 120p, 140p, 240p, 360p');
  console.log('   • FPS Control: 5-30 FPS');
  console.log('   • Multi-device support');
  console.log('');
  console.log('📡 Waiting for Android device...');
  console.log('');
});
