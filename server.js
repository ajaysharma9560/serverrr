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

let latestFrames = new Map(); // Store frames per device
let connectedDevices = [];
let currentSettings = {
  quality: 240,
  fps: 15,
  camera: "back"
};
let activeDeviceId = null; // Currently selected device for viewing

io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  // Register device
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || data.model || "Android Device",
      model: data.model || "Unknown",
      androidVersion: data.androidVersion || "Unknown",
      connectedAt: new Date().toISOString(),
      camera: data.camera || "back",
      online: true
    };
    
    // Check if already exists
    const existingIndex = connectedDevices.findIndex(d => d.id === socket.id);
    if (existingIndex >= 0) {
      connectedDevices[existingIndex] = device;
    } else {
      connectedDevices.push(device);
    }
    
    console.log(`✅ Device registered: ${device.name} (${device.id.substring(0, 8)})`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    
    // If no active device, set this as active
    if (!activeDeviceId) {
      activeDeviceId = socket.id;
    }
    
    socket.emit('settings_update', currentSettings);
    io.emit('devices_list', connectedDevices);
    io.emit('active_device', activeDeviceId);
  });
  
  // Receive frame from device
  socket.on('stream_frame', (data) => {
    if (data && data.image) {
      // Store frame for this specific device
      latestFrames.set(socket.id, {
        image: data.image,
        timestamp: Date.now(),
        quality: data.quality,
        fps: data.fps,
        camera: data.camera
      });
      
      // If this is the active device, broadcast to web
      if (activeDeviceId === socket.id) {
        io.emit('new_frame', { 
          image: data.image,
          timestamp: Date.now(),
          quality: data.quality,
          fps: data.fps,
          camera: data.camera,
          deviceId: socket.id
        });
      }
    }
  });
  
  // Receive command from web
  socket.on('command', (data) => {
    console.log('📡 Command:', data.command, data.value || '');
    
    // Update settings
    if (data.command === 'quality') {
      currentSettings.quality = data.value;
    } else if (data.command === 'fps') {
      currentSettings.fps = data.value;
    } else if (data.command === 'flip') {
      currentSettings.camera = currentSettings.camera === 'back' ? 'front' : 'back';
    }
    
    // Forward command to specific device or all devices
    if (data.deviceId) {
      // Send to specific device
      io.to(data.deviceId).emit('command', data);
      console.log(`  → Sent to device: ${data.deviceId.substring(0, 8)}`);
    } else {
      // Send to all devices (broadcast)
      io.emit('command', data);
      console.log(`  → Broadcast to all devices`);
    }
  });
  
  // Switch active device (for web viewing)
  socket.on('switch_device', (data) => {
    const newDeviceId = data.deviceId;
    const device = connectedDevices.find(d => d.id === newDeviceId);
    
    if (device) {
      activeDeviceId = newDeviceId;
      console.log(`🔄 Switched to device: ${device.name}`);
      io.emit('active_device', activeDeviceId);
      
      // Send latest frame of new device if available
      const latestFrame = latestFrames.get(activeDeviceId);
      if (latestFrame) {
        io.emit('new_frame', {
          image: latestFrame.image,
          timestamp: Date.now(),
          quality: latestFrame.quality,
          fps: latestFrame.fps,
          camera: latestFrame.camera,
          deviceId: activeDeviceId
        });
      }
    }
  });
  
  // Device disconnect
  socket.on('disconnect', () => {
    console.log('❌ Disconnected:', socket.id);
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    latestFrames.delete(socket.id);
    
    // If active device disconnected, switch to first available
    if (activeDeviceId === socket.id && connectedDevices.length > 0) {
      activeDeviceId = connectedDevices[0].id;
      io.emit('active_device', activeDeviceId);
      
      // Send frame of new active device
      const latestFrame = latestFrames.get(activeDeviceId);
      if (latestFrame) {
        io.emit('new_frame', {
          image: latestFrame.image,
          timestamp: Date.now(),
          quality: latestFrame.quality,
          fps: latestFrame.fps,
          camera: latestFrame.camera,
          deviceId: activeDeviceId
        });
      }
    } else if (connectedDevices.length === 0) {
      activeDeviceId = null;
      io.emit('active_device', null);
    }
    
    io.emit('devices_list', connectedDevices);
    console.log(`📊 Remaining devices: ${connectedDevices.length}`);
  });
  
  // Send current state to new client
  socket.emit('devices_list', connectedDevices);
  socket.emit('active_device', activeDeviceId);
});

// 🌐 Web Interface - Multi-Device Remote Control
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Multi-Device Remote Control</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #000;
                min-height: 100vh;
                color: #fff;
            }
            
            /* Fullscreen Mode */
            .fullscreen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                background: #000;
            }
            
            .fullscreen .video-container {
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .fullscreen .video-container img {
                max-height: 100%;
                object-fit: contain;
            }
            
            .fullscreen .controls-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
                padding: 20px;
            }
            
            /* Normal Mode */
            .container {
                max-width: 500px;
                margin: 0 auto;
                padding: 16px;
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
                background-clip: text;
            }
            
            .device-id {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
                font-family: monospace;
            }
            
            /* Status Bar */
            .status-bar {
                display: flex;
                justify-content: space-between;
                background: #1a1a1a;
                border-radius: 12px;
                padding: 12px 16px;
                margin-bottom: 16px;
            }
            
            .status-item {
                text-align: center;
                flex: 1;
            }
            
            .status-label {
                font-size: 10px;
                color: #666;
                margin-bottom: 4px;
            }
            
            .status-value {
                font-size: 16px;
                font-weight: 600;
            }
            
            .status-value.online {
                color: #4CAF50;
            }
            
            /* Video Container */
            .video-container {
                background: #000;
                border-radius: 16px;
                overflow: hidden;
                aspect-ratio: 4 / 3;
                position: relative;
                margin-bottom: 16px;
                border: 1px solid #333;
            }
            
            #videoStream {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .stream-status {
                position: absolute;
                top: 12px;
                left: 12px;
                background: rgba(0,0,0,0.7);
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 10px;
                font-weight: 500;
            }
            
            .stream-status.live {
                background: #f44336;
                animation: pulse 1.5s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            
            /* Zoom Button */
            .zoom-btn {
                position: absolute;
                bottom: 12px;
                right: 12px;
                background: rgba(0,0,0,0.7);
                border: none;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 18px;
                transition: all 0.3s;
            }
            
            .zoom-btn:hover {
                background: #667eea;
            }
            
            /* Controls Panel */
            .controls-panel {
                background: #1a1a1a;
                border-radius: 16px;
                padding: 16px;
                margin-bottom: 16px;
            }
            
            .panel-title {
                font-size: 11px;
                color: #666;
                margin-bottom: 12px;
                letter-spacing: 1px;
            }
            
            /* Button Group */
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
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .btn-start { background: #4CAF50; color: white; }
            .btn-stop { background: #f44336; color: white; }
            .btn-flip { background: #2196F3; color: white; }
            .btn:hover { transform: translateY(-2px); opacity: 0.9; }
            
            /* Quality Grid */
            .quality-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 20px;
            }
            
            .quality-btn {
                padding: 8px;
                border: 1px solid #333;
                background: #2a2a2a;
                color: white;
                border-radius: 10px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.3s;
                text-align: center;
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
                margin: 10px 0;
                -webkit-appearance: none;
                background: #333;
                height: 4px;
                border-radius: 2px;
            }
            
            .fps-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: #667eea;
                cursor: pointer;
            }
            
            .fps-value {
                text-align: center;
                font-size: 11px;
                color: #666;
            }
            
            /* Device List */
            .devices-panel {
                background: #1a1a1a;
                border-radius: 16px;
                padding: 16px;
            }
            
            .device-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid #333;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .device-item:hover {
                background: #252525;
                padding-left: 8px;
                border-radius: 8px;
            }
            
            .device-item.active {
                background: linear-gradient(135deg, #667eea20, #764ba220);
                padding-left: 8px;
                border-radius: 8px;
                border-left: 3px solid #667eea;
            }
            
            .device-info {
                flex: 1;
            }
            
            .device-name {
                font-size: 14px;
                font-weight: 500;
            }
            
            .device-details {
                font-size: 10px;
                color: #666;
                margin-top: 2px;
            }
            
            .device-status {
                font-size: 10px;
                color: #4CAF50;
            }
            
            .device-badge {
                background: #667eea;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 9px;
                margin-left: 8px;
            }
            
            /* Responsive */
            @media (max-width: 480px) {
                .container {
                    padding: 12px;
                }
                
                .quality-grid {
                    gap: 6px;
                }
                
                .quality-btn {
                    padding: 6px;
                    font-size: 10px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container" id="app">
            <div class="header">
                <h1>📹 Multi-Device Remote</h1>
                <div class="device-id" id="deviceId">Select a device to view</div>
            </div>
            
            <div class="status-bar">
                <div class="status-item">
                    <div class="status-label">STATUS</div>
                    <div class="status-value" id="statusValue">● Online</div>
                </div>
                <div class="status-item">
                    <div class="status-label">DEVICES</div>
                    <div class="status-value" id="deviceCount">0</div>
                </div>
                <div class="status-item">
                    <div class="status-label">FPS</div>
                    <div class="status-value" id="fpsValue">0</div>
                </div>
            </div>
            
            <div class="video-container" id="videoContainer">
                <img id="videoStream" src="" alt="Camera Stream">
                <div class="stream-status" id="streamStatus">🔴 No stream</div>
                <button class="zoom-btn" id="zoomBtn" onclick="toggleFullscreen()">⛶</button>
            </div>
            
            <div class="controls-panel">
                <div class="panel-title">🎮 CONTROLS</div>
                <div class="button-group">
                    <button class="btn btn-start" id="startBtn">▶ LIVE</button>
                    <button class="btn btn-stop" id="stopBtn">⏹ STOP</button>
                    <button class="btn btn-flip" id="flipBtn">🔄 CAMERA</button>
                </div>
                
                <div class="panel-title">📐 QUALITY</div>
                <div class="quality-grid">
                    <button class="quality-btn" data-quality="120">120p</button>
                    <button class="quality-btn" data-quality="140">140p</button>
                    <button class="quality-btn active" data-quality="240">240p</button>
                    <button class="quality-btn" data-quality="360">360p</button>
                </div>
                
                <div class="fps-control">
                    <div class="panel-title">⚡ FPS</div>
                    <input type="range" id="fpsSlider" min="10" max="30" step="5" value="15" class="fps-slider">
                    <div class="fps-value" id="fpsValueLabel">15 FPS</div>
                </div>
            </div>
            
            <div class="devices-panel">
                <div class="panel-title">📱 DEVICES (Tap to view)</div>
                <div id="devicesList">
                    <div style="text-align: center; color: #666; padding: 20px;">No devices connected</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            let activeDeviceId = null;
            let isFullscreen = false;
            
            // DOM Elements
            const videoStream = document.getElementById('videoStream');
            const streamStatus = document.getElementById('streamStatus');
            const statusValue = document.getElementById('statusValue');
            const deviceCountSpan = document.getElementById('deviceCount');
            const fpsValueSpan = document.getElementById('fpsValue');
            const devicesList = document.getElementById('devicesList');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsValueLabel = document.getElementById('fpsValueLabel');
            const videoContainer = document.getElementById('videoContainer');
            
            // Socket Events
            socket.on('connect', () => {
                console.log('Connected to server');
                statusValue.innerHTML = '● Online';
                statusValue.style.color = '#4CAF50';
            });
            
            socket.on('disconnect', () => {
                statusValue.innerHTML = '● Offline';
                statusValue.style.color = '#f44336';
            });
            
            socket.on('new_frame', (data) => {
                if (data && data.image) {
                    videoStream.src = 'data:image/jpeg;base64,' + data.image;
                    streamStatus.innerHTML = '🔴 LIVE';
                    streamStatus.classList.add('live');
                    
                    if (data.fps) {
                        fpsValueSpan.innerHTML = data.fps;
                    }
                }
            });
            
            socket.on('devices_list', (devices) => {
                deviceCountSpan.innerHTML = devices.length;
                
                if (devices.length === 0) {
                    devicesList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No devices connected</div>';
                    streamStatus.innerHTML = '🔴 No device';
                    streamStatus.classList.remove('live');
                    document.getElementById('deviceId').innerHTML = 'No devices connected';
                } else {
                    devicesList.innerHTML = devices.map(device => `
                        <div class="device-item ${activeDeviceId === device.id ? 'active' : ''}" onclick="switchDevice('${device.id}')">
                            <div class="device-info">
                                <div class="device-name">
                                    📱 ${device.name}
                                    ${activeDeviceId === device.id ? '<span class="device-badge">VIEWING</span>' : ''}
                                </div>
                                <div class="device-details">${device.model} | ${device.androidVersion}</div>
                            </div>
                            <div class="device-status">● Online</div>
                        </div>
                    `).join('');
                }
            });
            
            socket.on('active_device', (deviceId) => {
                activeDeviceId = deviceId;
                if (deviceId) {
                    const device = devicesListData.find(d => d.id === deviceId);
                    if (device) {
                        document.getElementById('deviceId').innerHTML = `Viewing: ${device.name}`;
                    }
                } else {
                    document.getElementById('deviceId').innerHTML = 'No active device';
                }
                
                // Update active highlight
                document.querySelectorAll('.device-item').forEach(el => {
                    el.classList.remove('active');
                });
                const activeEl = document.querySelector(`.device-item[onclick="switchDevice('${deviceId}')"]`);
                if (activeEl) activeEl.classList.add('active');
            });
            
            // Store devices data
            let devicesListData = [];
            socket.on('devices_list', (devices) => {
                devicesListData = devices;
            });
            
            // Switch Device
            window.switchDevice = function(deviceId) {
                console.log('Switching to device:', deviceId);
                socket.emit('switch_device', { deviceId: deviceId });
            };
            
            // Send Command to Active Device
            function sendCommand(command, value = null) {
                if (!activeDeviceId) {
                    alert('No device selected! Please select a device first.');
                    return;
                }
                const data = { command, deviceId: activeDeviceId };
                if (value !== null) data.value = value;
                socket.emit('command', data);
                console.log('Command to device:', command, value);
            }
            
            // Button Events
            document.getElementById('startBtn').onclick = () => sendCommand('start');
            document.getElementById('stopBtn').onclick = () => sendCommand('stop');
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
                fpsValueLabel.innerHTML = fps + ' FPS';
                sendCommand('fps', fps);
            };
            
            // Fullscreen Toggle
            window.toggleFullscreen = function() {
                const container = document.getElementById('app');
                if (!isFullscreen) {
                    container.classList.add('fullscreen');
                    isFullscreen = true;
                } else {
                    container.classList.remove('fullscreen');
                    isFullscreen = false;
                }
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
    activeDevice: activeDeviceId,
    hasFrame: latestFrames.size > 0,
    settings: currentSettings
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Multi-Device Remote Control Server Started');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
  console.log(`💪 Health Check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('📱 Multi-Device Features:');
  console.log('   ▶ Multiple devices can connect simultaneously');
  console.log('   📱 Tap any device to view its stream');
  console.log('   🎮 Controls affect the selected device');
  console.log('   🔄 LIVE/STOP/FLIP per device');
  console.log('   📐 Quality: 120p, 140p, 240p, 360p');
  console.log('   ⚡ FPS Control: 10-30 FPS');
  console.log('   ⛶ Zoom/Fullscreen button');
  console.log('');
  console.log('📊 Total devices connected: 0');
  console.log('');
});
