const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

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

// ========== STORAGE ==========
let connectedDevices = [];
let activeStream = false;
let currentQuality = 240;
let currentFps = 15;

// ========== SOCKET EVENTS ==========
io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  // ========== ANDROID DEVICE EVENTS ==========
  socket.on('register_device', (data) => {
    console.log('🔵 REGISTER_DEVICE received:', data);
    
    const device = {
      id: socket.id,
      name: data.deviceName || "Android Device",
      model: data.model || "Unknown",
      status: 'online',
      type: data.type || "camera",
      connectedAt: new Date().toLocaleTimeString()
    };
    
    const existingIndex = connectedDevices.findIndex(d => d.id === socket.id);
    if (existingIndex >= 0) {
      connectedDevices[existingIndex] = device;
    } else {
      connectedDevices.push(device);
    }
    
    console.log(`✅ Device registered: ${device.name}`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    
    // Broadcast to all web clients
    io.emit('devices_list', connectedDevices);
    
    // Send current settings to device
    socket.emit('settings', {
      quality: currentQuality,
      fps: currentFps,
      stream: activeStream
    });
    
    // Update status for web
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps
    });
  });
  
  socket.on('stream_frame', (data) => {
    if (data && data.image && activeStream) {
      io.emit('frame', {
        image: data.image,
        timestamp: Date.now(),
        quality: data.quality || currentQuality,
        fps: data.fps || currentFps
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Device disconnected:', socket.id);
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    io.emit('devices_list', connectedDevices);
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps
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
    
    // Forward to all Android devices
    connectedDevices.forEach(device => {
      io.to(device.id).emit('command', { command, value });
    });
    
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps
    });
  });
  
  // Send current state to new client
  socket.emit('devices_list', connectedDevices);
  socket.emit('status_update', {
    devices: connectedDevices.length,
    stream: activeStream,
    quality: currentQuality,
    fps: currentFps
  });
});

// ========== WEB INTERFACE - MODERN DARK DESIGN ==========
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Ludoo Cam</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui;
                background: #0f0f12;
                color: #e4e4e7;
                padding: 20px;
            }

            .container {
                max-width: 500px;
                margin: 0 auto;
            }

            /* Header */
            .header {
                text-align: center;
                margin-bottom: 24px;
            }

            .logo {
                font-size: 32px;
                font-weight: 700;
                background: linear-gradient(135deg, #a78bfa, #ec4899);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: -0.5px;
            }

            .sub {
                font-size: 12px;
                color: #71717a;
                margin-top: 6px;
            }

            /* Stats Grid */
            .stats-grid {
                display: flex;
                gap: 12px;
                margin-bottom: 24px;
            }

            .stat {
                flex: 1;
                background: #18181b;
                border-radius: 20px;
                padding: 14px;
                text-align: center;
                border: 1px solid #27272a;
            }

            .stat-label {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #71717a;
                margin-bottom: 6px;
            }

            .stat-value {
                font-size: 28px;
                font-weight: 700;
            }

            .online {
                color: #22c55e;
            }

            .live {
                color: #ef4444;
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            /* Video Section */
            .video-section {
                background: #000;
                border-radius: 24px;
                overflow: hidden;
                margin-bottom: 24px;
                border: 1px solid #27272a;
                position: relative;
                aspect-ratio: 16/9;
            }

            #video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: none;
            }

            .placeholder {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                color: #3f3f46;
            }

            .placeholder span {
                font-size: 48px;
                display: block;
                margin-bottom: 12px;
            }

            /* Control Card */
            .control-card {
                background: #18181b;
                border-radius: 24px;
                padding: 20px;
                margin-bottom: 24px;
                border: 1px solid #27272a;
            }

            .card-title {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                color: #71717a;
                margin-bottom: 16px;
            }

            /* Button Grid */
            .btn-group {
                display: flex;
                gap: 12px;
                margin-bottom: 24px;
            }

            .btn {
                flex: 1;
                padding: 14px;
                border: none;
                border-radius: 16px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: inherit;
            }

            .btn-start {
                background: #22c55e;
                color: white;
            }

            .btn-start:hover {
                background: #16a34a;
                transform: translateY(-2px);
            }

            .btn-stop {
                background: #ef4444;
                color: white;
            }

            .btn-stop:hover {
                background: #dc2626;
                transform: translateY(-2px);
            }

            .btn-flip {
                background: #3b82f6;
                color: white;
            }

            .btn-flip:hover {
                background: #2563eb;
                transform: translateY(-2px);
            }

            /* Quality Options */
            .quality-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 24px;
            }

            .quality-option {
                background: #27272a;
                padding: 12px;
                text-align: center;
                border-radius: 14px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s;
                border: 1px solid transparent;
            }

            .quality-option:hover {
                background: #3f3f46;
                transform: translateY(-1px);
            }

            .quality-option.active {
                background: linear-gradient(135deg, #a78bfa, #ec4899);
                border: none;
                color: white;
            }

            /* FPS Slider */
            .fps-control {
                margin-top: 8px;
            }

            .fps-slider {
                width: 100%;
                height: 4px;
                -webkit-appearance: none;
                background: #3f3f46;
                border-radius: 4px;
                margin: 12px 0;
            }

            .fps-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 18px;
                height: 18px;
                background: #a78bfa;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.2s;
            }

            .fps-slider::-webkit-slider-thumb:hover {
                transform: scale(1.2);
            }

            .fps-value {
                text-align: center;
                font-size: 13px;
                color: #a1a1aa;
            }

            /* Devices List */
            .devices-card {
                background: #18181b;
                border-radius: 24px;
                padding: 20px;
                border: 1px solid #27272a;
            }

            .device-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }

            .device-count {
                background: #27272a;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                color: #a78bfa;
            }

            .devices-list {
                max-height: 280px;
                overflow-y: auto;
            }

            .device-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                margin-bottom: 8px;
                background: #27272a;
                border-radius: 16px;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid transparent;
            }

            .device-item:hover {
                background: #3f3f46;
                transform: translateX(4px);
            }

            .device-item.active {
                border-color: #a78bfa;
                background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(236, 72, 153, 0.1));
            }

            .device-icon {
                font-size: 24px;
            }

            .device-info {
                flex: 1;
            }

            .device-name {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 4px;
            }

            .device-model {
                font-size: 11px;
                color: #71717a;
            }

            .device-status {
                width: 8px;
                height: 8px;
                background: #22c55e;
                border-radius: 50%;
                box-shadow: 0 0 8px #22c55e;
            }

            .empty-message {
                text-align: center;
                color: #52525b;
                padding: 32px;
            }

            /* Scrollbar */
            .devices-list::-webkit-scrollbar {
                width: 4px;
            }

            .devices-list::-webkit-scrollbar-track {
                background: #27272a;
                border-radius: 10px;
            }

            .devices-list::-webkit-scrollbar-thumb {
                background: #a78bfa;
                border-radius: 10px;
            }

            /* Responsive */
            @media (max-width: 480px) {
                body {
                    padding: 16px;
                }
                
                .stat-value {
                    font-size: 22px;
                }
                
                .btn {
                    padding: 12px;
                }
                
                .quality-option {
                    padding: 10px;
                    font-size: 12px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">ludoo</div>
                <div class="sub">camera remote controller</div>
            </div>

            <div class="stats-grid">
                <div class="stat">
                    <div class="stat-label">status</div>
                    <div class="stat-value" id="statusIndicator">●</div>
                </div>
                <div class="stat">
                    <div class="stat-label">devices</div>
                    <div class="stat-value" id="deviceCount">0</div>
                </div>
                <div class="stat">
                    <div class="stat-label">fps</div>
                    <div class="stat-value" id="fpsValue">0</div>
                </div>
            </div>

            <div class="video-section">
                <img id="video" alt="Live stream">
                <div id="placeholder" class="placeholder">
                    <span>📷</span>
                    <div>no active stream</div>
                </div>
            </div>

            <div class="control-card">
                <div class="card-title">controls</div>
                <div class="btn-group">
                    <button class="btn btn-start" id="startBtn">▶ start</button>
                    <button class="btn btn-stop" id="stopBtn">⏹ stop</button>
                    <button class="btn btn-flip" id="flipBtn">🔄 flip</button>
                </div>

                <div class="card-title">quality</div>
                <div class="quality-grid">
                    <div class="quality-option" data-quality="120">120p</div>
                    <div class="quality-option" data-quality="140">140p</div>
                    <div class="quality-option active" data-quality="240">240p</div>
                    <div class="quality-option" data-quality="360">360p</div>
                </div>

                <div class="fps-control">
                    <div class="card-title">frame rate</div>
                    <input type="range" id="fpsSlider" min="5" max="30" value="15" step="1" class="fps-slider">
                    <div class="fps-value" id="fpsLabel">15 fps</div>
                </div>
            </div>

            <div class="devices-card">
                <div class="device-header">
                    <div class="card-title" style="margin-bottom: 0;">connected devices</div>
                    <div class="device-count" id="deviceBadge">0</div>
                </div>
                <div class="devices-list" id="devicesList">
                    <div class="empty-message">no devices connected</div>
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

            // DOM elements
            const video = document.getElementById('video');
            const placeholder = document.getElementById('placeholder');
            const deviceCountSpan = document.getElementById('deviceCount');
            const deviceBadge = document.getElementById('deviceBadge');
            const fpsValueSpan = document.getElementById('fpsValue');
            const statusIndicator = document.getElementById('statusIndicator');
            const devicesList = document.getElementById('devicesList');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsLabel = document.getElementById('fpsLabel');

            // Frame counter
            socket.on('frame', (data) => {
                if (data && data.image && isStreaming) {
                    video.src = 'data:image/jpeg;base64,' + data.image;
                    video.style.display = 'block';
                    placeholder.style.display = 'none';
                    frameCount++;
                    
                    const now = Date.now();
                    if (now - lastFpsUpdate >= 1000) {
                        fpsValueSpan.textContent = frameCount;
                        frameCount = 0;
                        lastFpsUpdate = now;
                    }
                }
            });

            // Devices list update
            socket.on('devices_list', (devices) => {
                deviceCountSpan.textContent = devices.length;
                deviceBadge.textContent = devices.length;
                
                if (devices.length === 0) {
                    devicesList.innerHTML = '<div class="empty-message">no devices connected</div>';
                    video.style.display = 'none';
                    placeholder.style.display = 'block';
                } else {
                    devicesList.innerHTML = devices.map(device => 
                        '<div class="device-item" onclick="selectDevice(\'' + device.id + '\')">' +
                            '<div class="device-icon">📱</div>' +
                            '<div class="device-info">' +
                                '<div class="device-name">' + device.name + '</div>' +
                                '<div class="device-model">' + device.model + '</div>' +
                            '</div>' +
                            '<div class="device-status"></div>' +
                        '</div>'
                    ).join('');
                }
            });

            // Status update
            socket.on('status_update', (status) => {
                isStreaming = status.stream;
                
                if (status.stream) {
                    statusIndicator.innerHTML = '● live';
                    statusIndicator.className = 'stat-value live';
                } else {
                    statusIndicator.innerHTML = '● online';
                    statusIndicator.className = 'stat-value online';
                }
            });

            // Select device function
            window.selectDevice = function(deviceId) {
                selectedDeviceId = deviceId;
                isStreaming = false;
                video.style.display = 'none';
                placeholder.style.display = 'block';
                fpsValueSpan.textContent = '0';
                
                document.querySelectorAll('.device-item').forEach(el => {
                    el.classList.remove('active');
                });
                const activeEl = document.querySelector('.device-item[onclick="selectDevice(\'' + deviceId + '\')"]');
                if (activeEl) activeEl.classList.add('active');
            };

            // Send command
            function sendCommand(command, value) {
                socket.emit('command', { command, value });
            }

            // Event listeners
            document.getElementById('startBtn').onclick = () => {
                sendCommand('start');
                isStreaming = true;
            };
            
            document.getElementById('stopBtn').onclick = () => {
                sendCommand('stop');
                isStreaming = false;
                video.style.display = 'none';
                placeholder.style.display = 'block';
                fpsValueSpan.textContent = '0';
            };
            
            document.getElementById('flipBtn').onclick = () => sendCommand('flip');
            
            // Quality selector
            document.querySelectorAll('.quality-option').forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.quality-option').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const quality = parseInt(btn.dataset.quality);
                    sendCommand('quality', quality);
                };
            });
            
            // FPS slider
            fpsSlider.oninput = (e) => {
                const value = e.target.value;
                fpsLabel.textContent = value + ' fps';
                sendCommand('fps', parseInt(value));
            };
        </script>
    </body>
    </html>
  `);
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════╗
║     🎥 LUDOO CAMERA SERVER        ║
╠═══════════════════════════════════╣
║  Port: ${PORT}                          
║  Commands: start, stop, flip     ║
║            quality, fps           ║
╠═══════════════════════════════════╣
║  Ready for connections...         ║
╚═══════════════════════════════════╝
  `);
});
