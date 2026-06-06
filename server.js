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

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || data.model || "Android Device",
      model: data.model || "Unknown",
      connectedAt: new Date().toISOString()
    };
    connectedDevices.push(device);
    console.log(`✅ Device registered: ${device.name}`);
    io.emit('devices_list', connectedDevices);
    
    // Send test command to verify communication
    setTimeout(() => {
      socket.emit('command', { command: 'ping', value: 'Connection established' });
    }, 1000);
  });
  
  socket.on('stream_frame', (data) => {
    if (data && data.image) {
      latestFrame = data.image;
      io.emit('new_frame', { image: data.image, timestamp: Date.now() });
    }
  });
  
  // Handle commands from web
  socket.on('command', (data) => {
    console.log('📡 Command received from web:', data.command, data.value || '');
    
    // Broadcast to ALL connected Android devices
    if (connectedDevices.length > 0) {
      connectedDevices.forEach(device => {
        io.to(device.id).emit('command', {
          command: data.command,
          value: data.value
        });
      });
      console.log(`✅ Command sent to ${connectedDevices.length} device(s)`);
    } else {
      console.log('⚠️ No devices connected to send command');
    }
  });
  
  socket.on('disconnect', () => {
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    io.emit('devices_list', connectedDevices);
    console.log('❌ Device disconnected, remaining:', connectedDevices.length);
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
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                min-height: 100vh;
                padding: 20px;
            }
            
            .container {
                max-width: 1400px;
                margin: 0 auto;
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 20px;
                padding: 20px;
                margin-bottom: 20px;
                color: white;
                text-align: center;
            }
            
            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
            }
            
            .header p {
                opacity: 0.9;
            }
            
            .status-bar {
                display: flex;
                justify-content: center;
                gap: 20px;
                margin-top: 15px;
                flex-wrap: wrap;
            }
            
            .status-card {
                background: rgba(255,255,255,0.2);
                padding: 8px 16px;
                border-radius: 20px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            }
            
            .dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #4CAF50;
                animation: pulse 1.5s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .main-grid {
                display: grid;
                grid-template-columns: 1fr 320px;
                gap: 20px;
            }
            
            .video-section {
                background: #000;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
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
                max-height: 60vh;
                object-fit: contain;
            }
            
            .stream-status {
                position: absolute;
                top: 15px;
                left: 15px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
            }
            
            .controls-section {
                background: white;
                border-radius: 20px;
                padding: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            
            .control-group {
                margin-bottom: 20px;
            }
            
            .control-group label {
                display: block;
                margin-bottom: 10px;
                color: #333;
                font-weight: 600;
                font-size: 14px;
            }
            
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
                color: white;
            }
            
            .btn-start { background: #4CAF50; }
            .btn-stop { background: #f44336; }
            .btn-flip { background: #2196F3; }
            .btn:hover { transform: translateY(-2px); opacity: 0.9; }
            
            .quality-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
            }
            
            .quality-btn {
                padding: 10px;
                border: 2px solid #e0e0e0;
                background: #f5f5f5;
                border-radius: 10px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.3s;
                text-align: center;
            }
            
            .quality-btn.active {
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
            }
            
            .devices-list {
                max-height: 200px;
                overflow-y: auto;
            }
            
            .device-item {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 10px;
                margin-bottom: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .device-name {
                font-weight: 600;
                color: #333;
            }
            
            .device-status {
                font-size: 12px;
                color: #4CAF50;
            }
            
            @media (max-width: 768px) {
                .main-grid {
                    grid-template-columns: 1fr;
                }
                
                .quality-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Camera Controller</h1>
                <p>Live stream from your device</p>
                <div class="status-bar">
                    <div class="status-card">
                        <div class="dot"></div>
                        <span id="serverStatus">Server Online</span>
                    </div>
                    <div class="status-card">
                        📱 <span id="deviceCount">0</span> Device(s)
                    </div>
                    <div class="status-card">
                        🎬 <span id="fpsDisplay">0</span> FPS
                    </div>
                    <div class="status-card">
                        📐 <span id="qualityDisplay">240p</span>
                    </div>
                </div>
            </div>
            
            <div class="main-grid">
                <div class="video-section">
                    <div class="video-container">
                        <img id="videoStream" src="" alt="Live stream">
                        <div class="stream-status" id="streamStatus">🔴 No stream</div>
                    </div>
                </div>
                
                <div class="controls-section">
                    <div class="control-group">
                        <label>🎮 Controls</label>
                        <div class="btn-group">
                            <button class="btn btn-start" id="startBtn">▶ START</button>
                            <button class="btn btn-stop" id="stopBtn">⏹ STOP</button>
                            <button class="btn btn-flip" id="flipBtn">🔄 FLIP CAMERA</button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label>🎨 Quality (4 Options)</label>
                        <div class="quality-grid">
                            <button class="quality-btn" data-quality="120">120p</button>
                            <button class="quality-btn" data-quality="140">140p</button>
                            <button class="quality-btn active" data-quality="240">240p</button>
                            <button class="quality-btn" data-quality="360">360p</button>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label>⚡ FPS Control</label>
                        <input type="range" id="fpsSlider" min="5" max="30" value="15" class="fps-slider">
                        <div class="fps-value" id="fpsValue">15 FPS (Lower saves data)</div>
                    </div>
                </div>
            </div>
            
            <div class="devices-section">
                <h3>📱 Connected Devices</h3>
                <div class="devices-list" id="devicesContainer">
                    <div style="text-align: center; color: #999;">No devices connected</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            let frameCount = 0;
            let lastFpsUpdate = Date.now();
            
            const videoStream = document.getElementById('videoStream');
            const streamStatus = document.getElementById('streamStatus');
            const deviceCountSpan = document.getElementById('deviceCount');
            const devicesContainer = document.getElementById('devicesContainer');
            const fpsDisplay = document.getElementById('fpsDisplay');
            const qualityDisplay = document.getElementById('qualityDisplay');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsValue = document.getElementById('fpsValue');
            
            socket.on('connect', () => {
                document.getElementById('serverStatus').innerHTML = '● Online';
                console.log('Connected to server');
            });
            
            socket.on('new_frame', (data) => {
                if (data && data.image) {
                    videoStream.src = 'data:image/jpeg;base64,' + data.image;
                    streamStatus.innerHTML = '✅ LIVE STREAMING';
                    streamStatus.style.background = 'rgba(76,175,80,0.9)';
                    
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
                if (devices.length === 0) {
                    devicesContainer.innerHTML = '<div style="text-align: center; color: #999;">No devices connected</div>';
                    streamStatus.innerHTML = '🔴 No device';
                    streamStatus.style.background = 'rgba(0,0,0,0.8)';
                } else {
                    devicesContainer.innerHTML = devices.map(device => 
                        '<div class="device-item"><div class="device-name">📱 ' + device.name + '</div><div class="device-status">● Online</div></div>'
                    ).join('');
                    streamStatus.innerHTML = '🟡 Device ready';
                    streamStatus.style.background = 'rgba(255,152,0,0.9)';
                }
            });
            
            function sendCommand(command, value = null) {
                const data = { command };
                if (value !== null) data.value = value;
                socket.emit('command', data);
                console.log('Command sent to server:', command, value);
            }
            
            document.getElementById('startBtn').onclick = () => {
                sendCommand('start');
                streamStatus.innerHTML = '🟢 STARTING...';
            };
            
            document.getElementById('stopBtn').onclick = () => {
                sendCommand('stop');
                streamStatus.innerHTML = '🔴 STOPPED';
            };
            
            document.getElementById('flipBtn').onclick = () => {
                sendCommand('flip');
                console.log('Flip command sent');
            };
            
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
                fpsValue.textContent = fps + ' FPS (Lower saves data)';
                sendCommand('fps', fps);
            };
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
  console.log('📱 Waiting for Android device...');
  console.log('');
});
