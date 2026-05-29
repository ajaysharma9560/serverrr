const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  } 
});

// Store connected devices
const connectedDevices = new Map();

// HTML content
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Camera Controller - Multi Device</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        /* Header */
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            opacity: 0.9;
        }
        
        /* Main Grid */
        .main-grid {
            display: grid;
            grid-template-columns: 350px 1fr;
            gap: 20px;
        }
        
        /* Devices Panel */
        .devices-panel {
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
            padding: 20px;
            backdrop-filter: blur(10px);
        }
        
        .devices-panel h2 {
            font-size: 1.3em;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .device-list {
            max-height: 400px;
            overflow-y: auto;
        }
        
        .device-card {
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s;
            border: 2px solid transparent;
        }
        
        .device-card:hover {
            background: rgba(255,255,255,0.2);
            transform: translateX(5px);
        }
        
        .device-card.active {
            border-color: #22c55e;
            background: rgba(34,197,94,0.2);
        }
        
        .device-name {
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .device-status {
            font-size: 0.85em;
            margin-top: 5px;
        }
        
        .status-online {
            color: #22c55e;
        }
        
        .status-streaming {
            color: #3b82f6;
        }
        
        .device-info {
            font-size: 0.8em;
            opacity: 0.7;
            margin-top: 5px;
        }
        
        .no-devices {
            text-align: center;
            padding: 40px;
            opacity: 0.6;
        }
        
        /* Stream Panel */
        .stream-panel {
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
            padding: 20px;
            backdrop-filter: blur(10px);
        }
        
        .stream-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .active-device {
            font-size: 1.2em;
            font-weight: bold;
        }
        
        .stream-status {
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
        }
        
        .status-offline {
            background: #ef4444;
        }
        
        .status-online-badge {
            background: #22c55e;
        }
        
        /* Video Container */
        .video-container {
            background: #000;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 20px;
            aspect-ratio: 16/9;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        #streamImg {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        .placeholder {
            text-align: center;
            color: #666;
        }
        
        /* Stats */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            background: rgba(0,0,0,0.3);
            padding: 15px;
            border-radius: 10px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 2em;
            font-weight: bold;
        }
        
        .stat-label {
            font-size: 0.85em;
            opacity: 0.8;
            margin-top: 5px;
        }
        
        /* Quality Buttons */
        .quality-section {
            margin-bottom: 20px;
        }
        
        .quality-title {
            margin-bottom: 10px;
            font-size: 0.9em;
        }
        
        .quality-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .quality-btn {
            background: #1e293b;
            color: white;
            padding: 8px 20px;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .quality-btn.active {
            background: #22c55e;
        }
        
        /* Control Buttons */
        .control-buttons {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .control-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            transition: all 0.3s;
        }
        
        .control-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .btn-start {
            background: #22c55e;
            color: white;
        }
        
        .btn-stop {
            background: #ef4444;
            color: white;
        }
        
        .btn-flip {
            background: #3b82f6;
            color: white;
        }
        
        /* Toast */
        .toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 10px;
            z-index: 1000;
            animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(100px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
        
        /* Scrollbar */
        .device-list::-webkit-scrollbar {
            width: 8px;
        }
        
        .device-list::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
        }
        
        .device-list::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.3);
            border-radius: 10px;
        }
        
        @media (max-width: 768px) {
            .main-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📷 Camera Controller</h1>
            <p>Firebase Controlled Camera</p>
        </div>
        
        <div class="main-grid">
            <!-- Left Panel: Devices -->
            <div class="devices-panel">
                <h2>
                    📱 Connected Devices
                    <span id="deviceCount" style="font-size: 0.8em;">(0)</span>
                </h2>
                <div id="deviceList" class="device-list">
                    <div class="no-devices">
                        No device connected<br>
                        Waiting for Android app...
                    </div>
                </div>
            </div>
            
            <!-- Right Panel: Stream -->
            <div class="stream-panel">
                <div class="stream-header">
                    <div class="active-device">
                        🎥 <span id="activeDeviceName">No device selected</span>
                    </div>
                    <div>
                        <span id="streamStatusBadge" class="stream-status status-offline">Device Offline</span>
                    </div>
                </div>
                
                <div class="video-container">
                    <img id="streamImg" src="" alt="Live Feed">
                    <div id="placeholder" class="placeholder" style="display: none;">No device connected</div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" id="fps">0</div>
                        <div class="stat-label">📱 FPS</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="resolution">-</div>
                        <div class="stat-label">📐 Resolution</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="quality">-</div>
                        <div class="stat-label">🎨 Quality</div>
                    </div>
                </div>
                
                <div class="quality-section">
                    <div class="quality-title">Stream Quality</div>
                    <div class="quality-buttons">
                        <button class="quality-btn" data-quality="140p">140p</button>
                        <button class="quality-btn active" data-quality="240p">240p</button>
                        <button class="quality-btn" data-quality="360p">360p</button>
                    </div>
                </div>
                
                <div class="control-buttons">
                    <button class="control-btn btn-start" id="startBtn">▶ START</button>
                    <button class="control-btn btn-stop" id="stopBtn">⏹ STOP</button>
                    <button class="control-btn btn-flip" id="flipBtn">🔄 FLIP</button>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        const socket = io();
        let currentDevice = null;
        let frameCount = 0;
        let lastTime = Date.now();
        let currentQuality = '240p';
        
        // Quality mapping
        const qualityMap = {
            '140p': { width: 160, height: 140, label: '140p' },
            '240p': { width: 320, height: 240, label: '240p' },
            '360p': { width: 480, height: 360, label: '360p' }
        };
        
        // Update FPS
        function updateFPS() {
            const now = Date.now();
            if (now - lastTime >= 1000) {
                document.getElementById('fps').textContent = frameCount;
                frameCount = 0;
                lastTime = now;
            }
            requestAnimationFrame(updateFPS);
        }
        updateFPS();
        
        // Update device list UI
        function updateDeviceList(devices) {
            const deviceListDiv = document.getElementById('deviceList');
            const deviceCount = document.getElementById('deviceCount');
            
            if (devices.size === 0) {
                deviceListDiv.innerHTML = '<div class="no-devices">No device connected<br>Waiting for Android app...</div>';
                deviceCount.textContent = '(0)';
                return;
            }
            
            deviceCount.textContent = '(' + devices.size + ')';
            
            let html = '';
            devices.forEach((device, id) => {
                const isActive = currentDevice === id;
                const statusClass = device.streaming ? 'status-streaming' : 'status-online';
                const statusText = device.streaming ? '● Streaming' : '● Online';
                
                html += \`
                    <div class="device-card \${isActive ? 'active' : ''}" onclick="selectDevice('\${id}')">
                        <div class="device-name">\${device.name}</div>
                        <div class="device-status">
                            <span class="\${statusClass}">\${statusText}</span>
                        </div>
                        <div class="device-info">
                            📱 \${device.model || 'Android Device'}
                        </div>
                    </div>
                \`;
            });
            deviceListDiv.innerHTML = html;
        }
        
        // Select device
        function selectDevice(deviceId) {
            if (currentDevice === deviceId) return;
            
            currentDevice = deviceId;
            const device = connectedDevices.get(deviceId);
            
            if (device) {
                document.getElementById('activeDeviceName').textContent = device.name;
                document.getElementById('streamStatusBadge').textContent = device.streaming ? 'Streaming Live' : 'Device Online';
                document.getElementById('streamStatusBadge').className = device.streaming ? 'stream-status status-online-badge' : 'stream-status status-online-badge';
                
                showToast(\`Connected to \${device.name}\`);
            }
            
            updateDeviceList(connectedDevices);
        }
        
        // Store devices
        let connectedDevices = new Map();
        
        // Socket events
        socket.on('connect', () => {
            console.log('Connected to server');
            showToast('Connected to server');
        });
        
        // Device connected
        socket.on('device_connected', (deviceInfo) => {
            connectedDevices.set(deviceInfo.id, {
                ...deviceInfo,
                streaming: false
            });
            updateDeviceList(connectedDevices);
            showToast(\`\${deviceInfo.name} connected!\`);
        });
        
        // Device disconnected
        socket.on('device_disconnected', (deviceId) => {
            connectedDevices.delete(deviceId);
            if (currentDevice === deviceId) {
                currentDevice = null;
                document.getElementById('activeDeviceName').textContent = 'No device selected';
                document.getElementById('streamStatusBadge').textContent = 'Device Offline';
                document.getElementById('streamStatusBadge').className = 'stream-status status-offline';
                document.getElementById('streamImg').src = '';
            }
            updateDeviceList(connectedDevices);
            showToast('Device disconnected');
        });
        
        // Device streaming status
        socket.on('device_streaming', ({ deviceId, streaming }) => {
            if (connectedDevices.has(deviceId)) {
                const device = connectedDevices.get(deviceId);
                device.streaming = streaming;
                connectedDevices.set(deviceId, device);
                
                if (currentDevice === deviceId) {
                    document.getElementById('streamStatusBadge').textContent = streaming ? 'Streaming Live' : 'Device Online';
                }
                updateDeviceList(connectedDevices);
            }
        });
        
        // Receive frame
        socket.on('frame', (data) => {
            if (currentDevice) {
                document.getElementById('streamImg').src = data;
                frameCount++;
            }
        });
        
        // Update resolution
        socket.on('resolution_update', ({ deviceId, width, height, quality }) => {
            if (currentDevice === deviceId) {
                document.getElementById('resolution').textContent = \`\${width}x\${height}\`;
                document.getElementById('quality').textContent = quality;
            }
        });
        
        // Control buttons
        document.getElementById('startBtn').onclick = () => {
            if (!currentDevice) {
                showToast('Please select a device first!');
                return;
            }
            socket.emit('command', { deviceId: currentDevice, command: 'start' });
            showToast('Starting stream...');
        };
        
        document.getElementById('stopBtn').onclick = () => {
            if (!currentDevice) {
                showToast('Please select a device first!');
                return;
            }
            socket.emit('command', { deviceId: currentDevice, command: 'stop' });
            showToast('Stopping stream...');
        };
        
        document.getElementById('flipBtn').onclick = () => {
            if (!currentDevice) {
                showToast('Please select a device first!');
                return;
            }
            socket.emit('command', { deviceId: currentDevice, command: 'flip' });
            showToast('Flipping camera...');
        };
        
        // Quality buttons
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.onclick = () => {
                if (!currentDevice) {
                    showToast('Please select a device first!');
                    return;
                }
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const quality = btn.dataset.quality;
                currentQuality = quality;
                const qConfig = qualityMap[quality];
                socket.emit('quality', { deviceId: currentDevice, quality, width: qConfig.width, height: qConfig.height });
                showToast(\`Quality changed to \${quality}\`);
            };
        });
        
        function showToast(message) {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
    </script>
</body>
</html>
`;

app.get('/', (req, res) => {
  res.send(htmlContent);
});

// Socket.io logic
let devices = new Map();

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Register device (Android app)
  socket.on('register_device', (deviceInfo) => {
    devices.set(socket.id, {
      id: socket.id,
      name: deviceInfo.name,
      model: deviceInfo.model,
      streaming: false
    });
    
    console.log('Device registered:', deviceInfo.name);
    io.emit('device_connected', devices.get(socket.id));
    io.emit('device_list_update', Array.from(devices.values()));
  });
  
  // Frame from device
  socket.on('frame', (data) => {
    socket.broadcast.emit('frame', data);
  });
  
  // Command to specific device
  socket.on('command', ({ deviceId, command }) => {
    const targetSocket = io.sockets.sockets.get(deviceId);
    if (targetSocket) {
      targetSocket.emit('command', command);
      console.log('Command sent to device:', command);
    }
  });
  
  // Quality to specific device
  socket.on('quality', ({ deviceId, quality, width, height }) => {
    const targetSocket = io.sockets.sockets.get(deviceId);
    if (targetSocket) {
      targetSocket.emit('quality', { quality, width, height });
      console.log('Quality sent to device:', quality);
    }
  });
  
  // Device streaming status update
  socket.on('streaming_status', (streaming) => {
    if (devices.has(socket.id)) {
      const device = devices.get(socket.id);
      device.streaming = streaming;
      devices.set(socket.id, device);
      io.emit('device_streaming', { deviceId: socket.id, streaming });
    }
  });
  
  // Device resolution update
  socket.on('resolution_update', ({ width, height, quality }) => {
    io.emit('resolution_update', { deviceId: socket.id, width, height, quality });
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    if (devices.has(socket.id)) {
      const device = devices.get(socket.id);
      console.log('Device disconnected:', device.name);
      devices.delete(socket.id);
      io.emit('device_disconnected', socket.id);
      io.emit('device_list_update', Array.from(devices.values()));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
