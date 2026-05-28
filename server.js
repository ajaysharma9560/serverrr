const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { 
  cors: { origin: "*" },
  transports: ['polling', 'websocket'],
  allowEIO3: true
});

let devices = new Map();
let frameCount = 0;
let selectedDeviceId = null;

// Main Page - Control + Live Stream + Device List
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>📹 Multi Device Live Stream</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: linear-gradient(135deg, #000000, #1a1a2e); font-family: system-ui; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            
            /* Header */
            .header { text-align: center; margin-bottom: 25px; }
            .header h1 { color: white; font-size: 28px; margin-bottom: 5px; }
            .header p { color: #888; font-size: 14px; }
            
            /* Device List Section */
            .device-section {
                background: rgba(0,0,0,0.5);
                border-radius: 20px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .device-title {
                color: white;
                font-size: 16px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .device-count {
                background: #22c55e;
                padding: 2px 8px;
                border-radius: 20px;
                font-size: 12px;
            }
            .device-list {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
            }
            .device-card {
                background: rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 10px 15px;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid rgba(255,255,255,0.1);
                flex: 1;
                min-width: 120px;
            }
            .device-card:hover { background: rgba(255,255,255,0.2); }
            .device-card.selected {
                border: 2px solid #22c55e;
                background: rgba(34,197,94,0.2);
            }
            .device-name { color: white; font-weight: bold; font-size: 14px; }
            .device-status { font-size: 11px; margin-top: 4px; }
            .status-online { color: #22c55e; }
            .status-offline { color: #ef4444; }
            .device-id { font-size: 9px; color: #888; margin-top: 2px; }
            
            /* Stream Section */
            .stream-section {
                background: rgba(0,0,0,0.7);
                border-radius: 20px;
                padding: 20px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.15);
                margin-bottom: 20px;
            }
            .stream-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                color: white;
            }
            .live-badge {
                background: #ef4444;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                animation: blink 1s infinite;
            }
            .live-badge.offline {
                background: #555;
                animation: none;
            }
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            .video-container {
                background: #000;
                border-radius: 16px;
                overflow: hidden;
                aspect-ratio: 16/9;
                border: 2px solid #333;
                margin-bottom: 15px;
            }
            #streamImage {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .stream-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                color: #aaa;
                font-size: 13px;
            }
            .fps { color: #22c55e; font-family: monospace; font-size: 18px; font-weight: bold; }
            
            /* Control Section */
            .control-section {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-bottom: 10px;
            }
            button {
                padding: 12px 24px;
                font-size: 16px;
                font-weight: bold;
                border: none;
                border-radius: 40px;
                cursor: pointer;
                transition: transform 0.2s;
            }
            button:active { transform: scale(0.96); }
            .btn-start { background: #22c55e; color: white; box-shadow: 0 0 10px rgba(34,197,94,0.3); }
            .btn-stop { background: #ef4444; color: white; box-shadow: 0 0 10px rgba(239,68,68,0.3); }
            
            /* Footer */
            .footer { text-align: center; color: #555; font-size: 11px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Multi Device Live Stream</h1>
                <p>Real-time streaming from multiple phones</p>
            </div>
            
            <!-- Device List Section -->
            <div class="device-section">
                <div class="device-title">
                    <span>📱 Connected Devices</span>
                    <span class="device-count" id="deviceCount">0</span>
                </div>
                <div class="device-list" id="deviceList">
                    <div style="color:#888; text-align:center; width:100%;">Waiting for devices...</div>
                </div>
            </div>
            
            <!-- Stream Section -->
            <div class="stream-section">
                <div class="stream-header">
                    <span>🎥 Live Stream</span>
                    <span class="live-badge offline" id="liveBadge">OFFLINE</span>
                </div>
                <div class="video-container">
                    <img id="streamImage" src="">
                </div>
                <div class="stream-info">
                    <span>📡 Device: <span id="selectedDeviceName">None</span></span>
                    <span class="fps">⚡ <span id="fpsValue">0</span> FPS</span>
                </div>
                <div class="control-section">
                    <button class="btn-start" id="startBtn">▶ START</button>
                    <button class="btn-stop" id="stopBtn">⏹ STOP</button>
                </div>
            </div>
            
            <div class="footer">
                🔒 Secure | 🎯 Multi Device | 📡 PreviewCallback
            </div>
        </div>
        
        <script>
            const socket = io();
            let selectedDeviceId = null;
            let devicesData = {};
            let fps = 0, lastFpsUpdate = Date.now();
            
            const deviceListDiv = document.getElementById('deviceList');
            const deviceCountSpan = document.getElementById('deviceCount');
            const streamImage = document.getElementById('streamImage');
            const liveBadge = document.getElementById('liveBadge');
            const selectedDeviceNameSpan = document.getElementById('selectedDeviceName');
            const fpsSpan = document.getElementById('fpsValue');
            const startBtn = document.getElementById('startBtn');
            const stopBtn = document.getElementById('stopBtn');
            
            // Update FPS counter
            function updateFPS() {
                const now = Date.now();
                if (now - lastFpsUpdate >= 1000) {
                    fpsSpan.innerText = fps;
                    fps = 0;
                    lastFpsUpdate = now;
                }
                requestAnimationFrame(updateFPS);
            }
            updateFPS();
            
            // Select device
            function selectDevice(deviceId) {
                selectedDeviceId = deviceId;
                const device = devicesData[deviceId];
                if (device) {
                    selectedDeviceNameSpan.innerText = device.name || deviceId.substring(0, 15);
                }
                // Highlight selected device
                renderDevices();
                socket.emit('select-device', deviceId);
            }
            
            // Render device list
            function renderDevices() {
                const devices = Object.values(devicesData);
                deviceCountSpan.innerText = devices.length;
                
                if (devices.length === 0) {
                    deviceListDiv.innerHTML = '<div style="color:#888; text-align:center; width:100%;">No devices connected...</div>';
                    return;
                }
                
                deviceListDiv.innerHTML = devices.map(device => \`
                    <div class="device-card \${selectedDeviceId === device.id ? 'selected' : ''}" onclick="selectDevice('\${device.id}')">
                        <div class="device-name">📱 \${device.name || device.id.substring(0, 10)}</div>
                        <div class="device-status">
                            <span class="status-\${device.status}">● \${device.status === 'online' ? 'Online' : 'Offline'}</span>
                        </div>
                        <div class="device-id">\${device.id.substring(0, 15)}...</div>
                    </div>
                \`).join('');
            }
            
            // Socket events
            socket.on('connect', () => {
                console.log('Connected to server');
            });
            
            socket.on('device-list', (devices) => {
                devicesData = devices;
                renderDevices();
            });
            
            socket.on('frame', (data) => {
                if (data) {
                    streamImage.src = data;
                    fps++;
                    liveBadge.innerText = 'LIVE';
                    liveBadge.className = 'live-badge';
                }
            });
            
            socket.on('disconnect', () => {
                liveBadge.innerText = 'OFFLINE';
                liveBadge.className = 'live-badge offline';
            });
            
            startBtn.onclick = () => {
                if (selectedDeviceId) {
                    socket.emit('command', { deviceId: selectedDeviceId, command: 'start' });
                }
            };
            
            stopBtn.onclick = () => {
                if (selectedDeviceId) {
                    socket.emit('command', { deviceId: selectedDeviceId, command: 'stop' });
                }
            };
            
            window.selectDevice = selectDevice;
        </script>
    </body>
    </html>
  `);
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('✅ New connection:', socket.id);
  let currentDeviceId = null;
  let currentDeviceName = null;
  
  socket.on('register', (data) => {
    currentDeviceId = data.deviceId;
    currentDeviceName = data.deviceName || data.deviceId.substring(0, 10);
    
    devices.set(currentDeviceId, {
      id: currentDeviceId,
      name: currentDeviceName,
      status: 'online',
      socketId: socket.id,
      lastSeen: Date.now()
    });
    
    console.log(`📱 Device registered: ${currentDeviceName} (${currentDeviceId})`);
    broadcastDeviceList();
  });
  
  socket.on('frame', (data) => {
    io.emit('frame', data);
    frameCount++;
    if (frameCount % 30 === 0) {
      console.log(`📸 Frames forwarded: ${frameCount}`);
    }
  });
  
  socket.on('command', (data) => {
    const device = devices.get(data.deviceId);
    if (device && device.socketId) {
      io.to(device.socketId).emit('command', data.command);
      console.log(`🎮 Command "${data.command}" sent to ${device.name}`);
    }
  });
  
  socket.on('select-device', (deviceId) => {
    selectedDeviceId = deviceId;
    console.log(`📺 Selected device: ${deviceId}`);
  });
  
  socket.on('heartbeat', (data) => {
    const device = devices.get(data.deviceId);
    if (device) {
      device.status = 'online';
      device.lastSeen = Date.now();
      devices.set(data.deviceId, device);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    if (currentDeviceId) {
      const device = devices.get(currentDeviceId);
      if (device) {
        device.status = 'offline';
        devices.set(currentDeviceId, device);
        console.log(`📱 Device offline: ${device.name}`);
        broadcastDeviceList();
      }
    }
  });
});

function broadcastDeviceList() {
  const list = {};
  for (let [id, device] of devices) {
    list[id] = {
      id: device.id,
      name: device.name,
      status: device.status
    };
  }
  io.emit('device-list', list);
}

// Clean offline devices every 30 seconds
setInterval(() => {
  const now = Date.now();
  let updated = false;
  for (let [id, device] of devices) {
    if (device.status === 'online' && now - device.lastSeen > 15000) {
      device.status = 'offline';
      devices.set(id, device);
      updated = true;
      console.log(`⏰ Device timeout: ${device.name}`);
    }
  }
  if (updated) broadcastDeviceList();
}, 15000);

// Keep server awake
setInterval(() => {
  console.log(`💓 Server alive - Devices: ${devices.size}`);
}, 30000);

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ MULTI DEVICE STREAM SERVER READY');
  console.log('═══════════════════════════════════════');
  console.log(`📍 Open: https://your-replit.repl.co`);
  console.log('═══════════════════════════════════════');
});
