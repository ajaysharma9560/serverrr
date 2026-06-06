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
    
    connectedDevices.push(device);
    console.log(`✅ Device registered: ${device.name}`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    
    // Send current settings to device
    socket.emit('settings', {
      quality: currentQuality,
      fps: currentFps,
      stream: activeStream
    });
    
    // Update web panel
    io.emit('devices_list', connectedDevices);
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps
    });
  });
  
  socket.on('stream_frame', (data) => {
    if (data && data.image && activeStream) {
      // Broadcast to all web clients
      io.emit('frame', {
        image: data.image,
        timestamp: Date.now(),
        quality: data.quality || currentQuality,
        fps: data.fps || currentFps
      });
    }
  });
  
  socket.on('device_status', (data) => {
    console.log(`📊 Device status: ${data.status}`);
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
  });
  
  // ========== WEB COMMAND HANDLER ==========
  
  socket.on('command', (data) => {
    const { command, value } = data;
    console.log(`🎮 Command: ${command} ${value ? '= ' + value : ''}`);
    
    // Update local state
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
    
    // Forward command to all connected Android devices
    connectedDevices.forEach(device => {
      io.to(device.id).emit('command', { command, value });
    });
    
    // Update web panel status
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps
    });
  });
  
  // Send initial status to new web client
  socket.emit('status_update', {
    devices: connectedDevices.length,
    stream: activeStream,
    quality: currentQuality,
    fps: currentFps
  });
  socket.emit('devices_list', connectedDevices);
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background: #0a0a0a;
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
                font-size: 24px;
                font-weight: 600;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .header p {
                font-size: 12px;
                color: #666;
                margin-top: 5px;
            }
            
            /* Status Cards */
            .stats {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .stat-card {
                background: #1a1a1a;
                border-radius: 12px;
                padding: 12px;
                text-align: center;
                border: 1px solid #2a2a2a;
            }
            
            .stat-label {
                font-size: 11px;
                color: #888;
                margin-bottom: 5px;
            }
            
            .stat-value {
                font-size: 20px;
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
                border-radius: 16px;
                overflow: hidden;
                aspect-ratio: 16 / 9;
                margin-bottom: 20px;
                border: 1px solid #2a2a2a;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            #video {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .video-placeholder {
                text-align: center;
                color: #555;
            }
            
            .video-placeholder span {
                font-size: 48px;
            }
            
            /* Controls */
            .controls {
                background: #1a1a1a;
                border-radius: 16px;
                padding: 16px;
                margin-bottom: 20px;
                border: 1px solid #2a2a2a;
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
                transition: all 0.2s;
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
            
            /* Quality Grid */
            .quality-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 20px;
            }
            
            .quality-btn {
                padding: 10px;
                border: 1px solid #2a2a2a;
                background: #0a0a0a;
                color: #fff;
                border-radius: 10px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            
            .quality-btn.active {
                background: #667eea;
                border-color: #667eea;
            }
            
            /* FPS Slider */
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
                width: 16px;
                height: 16px;
                background: #667eea;
                border-radius: 50%;
                cursor: pointer;
            }
            
            .fps-value {
                text-align: center;
                font-size: 12px;
                color: #888;
            }
            
            /* Device List */
            .devices {
                background: #1a1a1a;
                border-radius: 16px;
                padding: 16px;
                border: 1px solid #2a2a2a;
            }
            
            .device-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid #2a2a2a;
            }
            
            .device-item:last-child {
                border-bottom: none;
            }
            
            .device-name {
                font-size: 14px;
                font-weight: 500;
            }
            
            .device-status {
                width: 8px;
                height: 8px;
                background: #4CAF50;
                border-radius: 50%;
            }
            
            .empty-devices {
                text-align: center;
                color: #555;
                padding: 20px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Ludoo Remote</h1>
                <p>15 FPS | Low Data Streaming</p>
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
            
            <div class="video-container">
                <img id="video" style="display: none;">
                <div id="placeholder" class="video-placeholder">
                    <span>📷</span><br>
                    No stream
                </div>
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
                <div class="section-title">📱 CONNECTED DEVICES</div>
                <div id="devicesList">
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
            
            // DOM Elements
            const video = document.getElementById('video');
            const placeholder = document.getElementById('placeholder');
            const deviceCountSpan = document.getElementById('deviceCount');
            const fpsCountSpan = document.getElementById('fpsCount');
            const devicesList = document.getElementById('devicesList');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsLabel = document.getElementById('fpsLabel');
            
            // ========== SOCKET EVENTS ==========
            
            socket.on('connect', () => {
                console.log('Connected to server');
                document.getElementById('serverStatus').innerHTML = '● Online';
                document.getElementById('serverStatus').style.color = '#4CAF50';
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
                deviceCountSpan.textContent = devices.length;
                
                if (devices.length === 0) {
                    devicesList.innerHTML = '<div class="empty-devices">No devices connected</div>';
                    video.style.display = 'none';
                    placeholder.style.display = 'block';
                    isStreaming = false;
                } else {
                    devicesList.innerHTML = devices.map(device => `
                        <div class="device-item">
                            <span class="device-name">📱 ${device.name}</span>
                            <div class="device-status"></div>
                        </div>
                    `).join('');
                }
            });
            
            socket.on('status_update', (status) => {
                isStreaming = status.stream;
                if (status.stream) {
                    document.getElementById('serverStatus').innerHTML = '● LIVE';
                    document.getElementById('serverStatus').style.color = '#f44336';
                } else {
                    document.getElementById('serverStatus').innerHTML = '● Online';
                    document.getElementById('serverStatus').style.color = '#4CAF50';
                }
            });
            
            // ========== COMMAND FUNCTIONS ==========
            
            function sendCommand(command, value = null) {
                socket.emit('command', { command, value });
                console.log('Command:', command, value);
            }
            
            // Button Handlers
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
    streamActive: activeStream,
    quality: currentQuality,
    fps: currentFps,
    uptime: process.uptime()
  });
});

// Start server
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
  console.log('   • START / STOP - Control streaming');
  console.log('   • FLIP - Front/Back camera');
  console.log('   • 4 Qualities: 120p, 140p, 240p, 360p');
  console.log('   • FPS Control: 5-30 FPS');
  console.log('   • Multi-device support');
  console.log('   • 15 FPS default for low data usage');
  console.log('');
  console.log('📡 Waiting for Android device...');
  console.log('');
});
