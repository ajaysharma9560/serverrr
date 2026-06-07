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
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Store state
let connectedDevices = [];
let activeStream = false;
let currentQuality = 240;
let currentFps = 15;
let selectedDeviceId = null;

io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  // ========== ANDROID DEVICE EVENTS ==========
  
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || "Android Device",
      model: data.model || "Unknown",
      camera: data.camera || "back",
      status: 'online',
      connectedAt: new Date().toLocaleTimeString()
    };
    
    const existingIndex = connectedDevices.findIndex(d => d.id === socket.id);
    if (existingIndex >= 0) {
      connectedDevices[existingIndex] = device;
    } else {
      connectedDevices.push(device);
    }
    
    if (!selectedDeviceId) {
      selectedDeviceId = socket.id;
    }
    
    console.log(`✅ Device registered: ${device.name}`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    
    io.emit('devices_list', connectedDevices);
    io.emit('selected_device', selectedDeviceId);
    
    socket.emit('settings', {
      quality: currentQuality,
      fps: currentFps,
      stream: activeStream
    });
    
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
  });
  
  socket.on('stream_frame', (data) => {
    if (data && data.image && activeStream && selectedDeviceId === socket.id) {
      io.emit('frame', {
        image: data.image,
        timestamp: Date.now(),
        quality: data.quality || currentQuality,
        fps: data.fps || currentFps
      });
    }
  });
  
  socket.on('select_device', (data) => {
    const deviceId = data.deviceId;
    const device = connectedDevices.find(d => d.id === deviceId);
    if (device) {
      selectedDeviceId = deviceId;
      console.log(`🖱️ Selected device: ${device.name}`);
      io.emit('selected_device', selectedDeviceId);
      io.emit('status_update', {
        devices: connectedDevices.length,
        stream: activeStream,
        quality: currentQuality,
        fps: currentFps,
        selectedDevice: selectedDeviceId
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Device disconnected:', socket.id);
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    
    if (selectedDeviceId === socket.id && connectedDevices.length > 0) {
      selectedDeviceId = connectedDevices[0].id;
      io.emit('selected_device', selectedDeviceId);
    } else if (connectedDevices.length === 0) {
      selectedDeviceId = null;
    }
    
    io.emit('devices_list', connectedDevices);
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
    console.log(`📊 Remaining devices: ${connectedDevices.length}`);
  });
  
  // ========== WEB COMMAND HANDLER ==========
  
  socket.on('command', (data) => {
    const { command, value } = data;
    console.log(`🎮 Command: ${command} ${value ? '= ' + value : ''}`);
    
    switch(command) {
      case 'start':
        activeStream = true;
        console.log('▶ Stream STARTED');
        break;
      case 'stop':
        activeStream = false;
        console.log('⏹ Stream STOPPED');
        break;
      case 'flip':
        console.log('🔄 Flip camera');
        break;
      case 'quality':
        currentQuality = value;
        console.log(`🎨 Quality: ${value}p`);
        break;
      case 'fps':
        currentFps = value;
        console.log(`⚡ FPS: ${value}`);
        break;
    }
    
    if (selectedDeviceId) {
      io.to(selectedDeviceId).emit('command', { command, value });
    }
    
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
  });
  
  socket.emit('devices_list', connectedDevices);
  socket.emit('selected_device', selectedDeviceId);
  socket.emit('status_update', {
    devices: connectedDevices.length,
    stream: activeStream,
    quality: currentQuality,
    fps: currentFps,
    selectedDevice: selectedDeviceId
  });
});

// ========== WEB INTERFACE ==========

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Ludoo Camera Remote</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
                min-height: 100vh;
                padding: 20px;
                color: #fff;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
            }
            
            /* Header */
            .header {
                text-align: center;
                margin-bottom: 20px;
            }
            
            .header h1 {
                font-size: 28px;
                background: linear-gradient(135deg, #667eea, #764ba2, #f093fb);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .header p {
                font-size: 12px;
                color: #888;
                margin-top: 5px;
            }
            
            /* Stats Cards */
            .stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .stat-card {
                background: rgba(26, 26, 42, 0.8);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                padding: 15px;
                text-align: center;
                border: 1px solid rgba(102, 126, 234, 0.3);
                transition: transform 0.3s;
            }
            
            .stat-card:hover {
                transform: translateY(-2px);
                border-color: #667eea;
            }
            
            .stat-label {
                font-size: 11px;
                color: #888;
                margin-bottom: 5px;
                letter-spacing: 1px;
            }
            
            .stat-value {
                font-size: 24px;
                font-weight: 700;
            }
            
            .stat-value.online {
                color: #4CAF50;
            }
            
            .stat-value.streaming {
                color: #f44336;
                animation: pulse 1s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            
            /* Video Container */
            .video-container {
                background: #000;
                border-radius: 20px;
                overflow: hidden;
                aspect-ratio: 16 / 9;
                margin-bottom: 20px;
                border: 2px solid rgba(102, 126, 234, 0.5);
                position: relative;
                transition: all 0.3s;
            }
            
            .video-container:hover {
                border-color: #667eea;
            }
            
            #video {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .video-placeholder {
                text-align: center;
                color: #555;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .video-placeholder span {
                font-size: 48px;
            }
            
            /* Fullscreen Button */
            .fullscreen-btn {
                position: absolute;
                bottom: 15px;
                right: 15px;
                background: rgba(0,0,0,0.7);
                backdrop-filter: blur(5px);
                border: none;
                color: white;
                font-size: 20px;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                transition: all 0.3s;
            }
            
            .fullscreen-btn:hover {
                background: #667eea;
                transform: scale(1.05);
            }
            
            .video-container.fullscreen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                margin: 0;
                border-radius: 0;
                aspect-ratio: auto;
            }
            
            .video-container.fullscreen .fullscreen-btn {
                bottom: 25px;
                right: 25px;
            }
            
            /* Controls Section */
            .controls {
                background: rgba(26, 26, 42, 0.8);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 20px;
                margin-bottom: 20px;
                border: 1px solid rgba(102, 126, 234, 0.3);
            }
            
            .section-title {
                font-size: 12px;
                color: #888;
                margin-bottom: 12px;
                letter-spacing: 1px;
            }
            
            .button-group {
                display: flex;
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .btn {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .btn-start {
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
            }
            
            .btn-start:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(76, 175, 80, 0.4);
            }
            
            .btn-stop {
                background: linear-gradient(135deg, #f44336, #da190b);
                color: white;
            }
            
            .btn-stop:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(244, 67, 54, 0.4);
            }
            
            .btn-flip {
                background: linear-gradient(135deg, #2196F3, #0b7dda);
                color: white;
            }
            
            .btn-flip:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(33, 150, 243, 0.4);
            }
            
            /* Quality Grid */
            .quality-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 20px;
            }
            
            .quality-btn {
                padding: 10px;
                border: 1px solid rgba(102, 126, 234, 0.3);
                background: rgba(10, 10, 10, 0.6);
                color: #fff;
                border-radius: 10px;
                cursor: pointer;
                font-size: 12px;
                text-align: center;
                transition: all 0.3s;
            }
            
            .quality-btn:hover {
                border-color: #667eea;
                transform: translateY(-2px);
            }
            
            .quality-btn.active {
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-color: #667eea;
            }
            
            /* FPS Control */
            .fps-control {
                margin-top: 16px;
            }
            
            .fps-slider {
                width: 100%;
                height: 4px;
                -webkit-appearance: none;
                background: #2a2a2a;
                border-radius: 2px;
                margin: 10px 0;
            }
            
            .fps-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 18px;
                height: 18px;
                background: #667eea;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .fps-slider::-webkit-slider-thumb:hover {
                transform: scale(1.2);
            }
            
            .fps-value {
                text-align: center;
                font-size: 12px;
                color: #888;
            }
            
            /* Device Panel */
            .devices {
                background: rgba(26, 26, 42, 0.8);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 20px;
                border: 1px solid rgba(102, 126, 234, 0.3);
            }
            
            .device-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .device-header h3 {
                font-size: 14px;
                color: #888;
                letter-spacing: 1px;
            }
            
            .device-count {
                background: rgba(102, 126, 234, 0.3);
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                color: #667eea;
            }
            
            .devices-list {
                max-height: 250px;
                overflow-y: auto;
            }
            
            .device-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                margin-bottom: 8px;
                background: rgba(10, 10, 10, 0.5);
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s;
                border: 1px solid transparent;
            }
            
            .device-item:hover {
                background: rgba(102, 126, 234, 0.2);
                transform: translateX(5px);
                border-color: #667eea;
            }
            
            .device-item.active {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3));
                border-color: #667eea;
            }
            
            .device-info {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .device-icon {
                font-size: 24px;
            }
            
            .device-name {
                font-size: 14px;
                font-weight: 500;
            }
            
            .device-model {
                font-size: 10px;
                color: #888;
                margin-top: 2px;
            }
            
            .device-status-dot {
                width: 8px;
                height: 8px;
                background: #4CAF50;
                border-radius: 50%;
                animation: pulse 1.5s infinite;
            }
            
            .device-badge {
                font-size: 9px;
                background: #667eea;
                padding: 2px 8px;
                border-radius: 12px;
                margin-left: 8px;
            }
            
            .empty-devices {
                text-align: center;
                color: #555;
                padding: 30px;
            }
            
            /* Scrollbar */
            .devices-list::-webkit-scrollbar {
                width: 4px;
            }
            
            .devices-list::-webkit-scrollbar-track {
                background: #1a1a1a;
                border-radius: 10px;
            }
            
            .devices-list::-webkit-scrollbar-thumb {
                background: #667eea;
                border-radius: 10px;
            }
            
            /* Responsive */
            @media (max-width: 480px) {
                body {
                    padding: 12px;
                }
                
                .stats {
                    gap: 8px;
                }
                
                .stat-card {
                    padding: 10px;
                }
                
                .stat-value {
                    font-size: 18px;
                }
                
                .quality-grid {
                    gap: 6px;
                }
                
                .quality-btn {
                    padding: 8px;
                    font-size: 10px;
                }
                
                .device-name {
                    font-size: 12px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Ludoo Remote</h1>
                <p id="selectedDeviceLabel">Click on a device to view stream</p>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-label">STATUS</div>
                    <div class="stat-value" id="serverStatus">● Online</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">DEVICES</div>
                    <div class="stat-value" id="deviceCount">0</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">FPS</div>
                    <div class="stat-value" id="fpsCount">0</div>
                </div>
            </div>
            
            <div class="video-container" id="videoContainer">
                <img id="video" style="display: none;">
                <div id="placeholder" class="video-placeholder">
                    <span>📷</span><br>
                    No active stream
                </div>
                <button class="fullscreen-btn" id="fullscreenBtn">⛶</button>
            </div>
            
            <div class="controls">
                <div class="section-title">🎮 CONTROLS</div>
                <div class="button-group">
                    <button class="btn btn-start" id="startBtn">▶ START</button>
                    <button class="btn btn-stop" id="stopBtn">⏹ STOP</button>
                    <button class="btn btn-flip" id="flipBtn">🔄 FLIP</button>
                </div>
                
                <div class="section-title">📐 QUALITY</div>
                <div class="quality-grid">
                    <button class="quality-btn" data-quality="120">120p</button>
                    <button class="quality-btn" data-quality="140">140p</button>
                    <button class="quality-btn active" data-quality="240">240p</button>
                    <button class="quality-btn" data-quality="360">360p</button>
                </div>
                
                <div class="fps-control">
                    <div class="section-title">⚡ FPS</div>
                    <input type="range" id="fpsSlider" min="5" max="30" value="15" step="1" class="fps-slider">
                    <div class="fps-value" id="fpsLabel">15 FPS (Recommended)</div>
                </div>
            </div>
            
            <div class="devices">
                <div class="device-header">
                    <h3>📱 CONNECTED DEVICES</h3>
                    <div class="device-count" id="deviceCountBadge">0</div>
                </div>
                <div class="devices-list" id="devicesList">
                    <div class="empty-devices">No devices connected</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            let frameCount = 0;
            let lastFpsUpdate = Date.now();
            let isStreaming = false;
            let selectedDeviceId = null;
            let devicesData = [];
            
            // DOM Elements
            const video = document.getElementById('video');
            const placeholder = document.getElementById('placeholder');
            const deviceCountSpan = document.getElementById('deviceCount');
            const deviceCountBadge = document.getElementById('deviceCountBadge');
            const fpsCountSpan = document.getElementById('fpsCount');
            const devicesList = document.getElementById('devicesList');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsLabel = document.getElementById('fpsLabel');
            const selectedDeviceLabel = document.getElementById('selectedDeviceLabel');
            const videoContainer = document.getElementById('videoContainer');
            const fullscreenBtn = document.getElementById('fullscreenBtn');
            
            // Fullscreen Function
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    videoContainer.requestFullscreen().catch(err => console.log(err));
                } else {
                    document.exitFullscreen();
                }
            });
            
            document.addEventListener('fullscreenchange', () => {
                if (document.fullscreenElement) {
                    videoContainer.classList.add('fullscreen');
                } else {
                    videoContainer.classList.remove('fullscreen');
                }
            });
            
            // Socket Events
            socket.on('connect', () => {
                console.log('✅ Connected to server');
            });
            
            socket.on('frame', (data) => {
                if (data && data.image && isStreaming) {
                    video.src = 'data:image/jpeg;base64,' + data.image;
                    video.style.display = 'block';
                    placeholder.style.display = 'none';
                    
                    frameCount++;
                    const now = Date.now();
                    if (now - lastFpsUpdate >= 1000) {
                        fpsCountSpan.textContent = frameCount;
                        frameCount = 0;
                        lastFpsUpdate = now;
                    }
                }
            });
            
            socket.on('devices_list', (devices) => {
                devicesData = devices;
                deviceCountSpan.textContent = devices.length;
                deviceCountBadge.textContent = devices.length;
                
                if (devices.length === 0) {
                    devicesList.innerHTML = '<div class="empty-devices">No devices connected</div>';
                    video.style.display = 'none';
                    placeholder.style.display = 'block';
                    isStreaming = false;
                    selectedDeviceLabel.innerHTML = 'Click on a device to view stream';
                } else {
                    devicesList.innerHTML = devices.map(device => `
                        <div class="device-item ${selectedDeviceId === device.id ? 'active' : ''}" onclick="selectDevice('${device.id}')">
                            <div class="device-info">
                                <span class="device-icon">📱</span>
                                <div>
                                    <div class="device-name">${device.name}</div>
                                    <div class="device-model">${device.model}</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="device-status-dot"></div>
                                ${selectedDeviceId === device.id ? '<span class="device-badge">VIEWING</span>' : ''}
                            </div>
                        </div>
                    `).join('');
                }
            });
            
            socket.on('selected_device', (deviceId) => {
                selectedDeviceId = deviceId;
                const device = devicesData.find(d => d.id === deviceId);
                if (device) {
                    selectedDeviceLabel.innerHTML = `Viewing: ${device.name}`;
                }
                
                document.querySelectorAll('.device-item').forEach(el => {
                    el.classList.remove('active');
                });
                const activeEl = document.querySelector(`.device-item[onclick="selectDevice('${deviceId}')"]`);
                if (activeEl) activeEl.classList.add('active');
            });
            
            socket.on('status_update', (status) => {
                isStreaming = status.stream;
                const serverStatus = document.getElementById('serverStatus');
                if (status.stream) {
                    serverStatus.innerHTML = '● LIVE';
                    serverStatus.style.color = '#f44336';
                    serverStatus.classList.add('streaming');
                } else {
                    serverStatus.innerHTML = '● Online';
                    serverStatus.style.color = '#4CAF50';
                    serverStatus.classList.remove('streaming');
                }
            });
            
            // Select Device Function
            window.selectDevice = function(deviceId) {
                console.log('📱 Selecting device:', deviceId);
                socket.emit('select_device', { deviceId: deviceId });
                isStreaming = false;
                video.style.display = 'none';
                placeholder.style.display = 'block';
                fpsCountSpan.textContent = '0';
            };
            
            // Send Command Function
            function sendCommand(command, value = null) {
                if (!selectedDeviceId) {
                    console.log('⚠️ No device selected');
                    selectedDeviceLabel.innerHTML = '⚠️ Please click on a device first!';
                    setTimeout(() => {
                        selectedDeviceLabel.innerHTML = 'Click on a device to view stream';
                    }, 2000);
                    return;
                }
                socket.emit('command', { command, value });
                console.log('🎮 Command sent:', command, value);
            }
            
            // Button Events
            document.getElementById('startBtn').onclick = () => {
                sendCommand('start');
                isStreaming = true;
            };
            document.getElementById('stopBtn').onclick = () => {
                sendCommand('stop');
                isStreaming = false;
                video.style.display = 'none';
                placeholder.style.display = 'block';
                fpsCountSpan.textContent = '0';
            };
            document.getElementById('flipBtn').onclick = () => sendCommand('flip');
            
            // Quality Buttons
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
                fpsLabel.textContent = fps + ' FPS';
                sendCommand('fps', fps);
            };
            
            console.log('🚀 Page loaded, waiting for devices...');
        </script>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devices: connectedDevices.length,
    streamActive: activeStream,
    quality: currentQuality,
    fps: currentFps,
    selectedDevice: selectedDeviceId,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Ludoo Camera Remote Server Started');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
  console.log(`💪 Health Check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('📱 Features:');
  console.log('   • Fullscreen button on video');
  console.log('   • Device panel with click to select');
  console.log('   • Multi-device support');
  console.log('   • Device shows ONLINE immediately');
  console.log('   • START/STOP/FLIP controls');
  console.log('   • 4 Quality options: 120p, 140p, 240p, 360p');
  console.log('   • FPS Control: 5-30 FPS');
  console.log('');
  console.log('📡 Waiting for Android device...');
  console.log('');
});
