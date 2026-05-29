const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  } 
});

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Store connected devices
const devices = new Map();

// Mobile Optimized HTML
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Camera Controller</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="theme-color" content="#000000">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        
        /* Header */
        .header {
            text-align: center;
            margin-bottom: 15px;
        }
        
        .header h1 {
            font-size: 1.8em;
            margin-bottom: 5px;
        }
        
        .header p {
            font-size: 0.8em;
            opacity: 0.8;
        }
        
        /* Status Card */
        .status-card {
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
            padding: 12px;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .status-badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 50px;
            font-weight: bold;
            font-size: 0.85em;
        }
        
        .online {
            background: #22c55e;
            animation: pulse 2s infinite;
        }
        
        .offline {
            background: #ef4444;
        }
        
        .connecting {
            background: #f59e0b;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .connection-info {
            margin-top: 6px;
            font-size: 0.7em;
            opacity: 0.8;
        }
        
        /* Device Selector */
        .device-selector {
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
            padding: 12px;
            margin-bottom: 15px;
        }
        
        .device-selector h3 {
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        
        .device-scroll {
            overflow-x: auto;
            white-space: nowrap;
            padding-bottom: 5px;
        }
        
        .device-chip {
            display: inline-block;
            background: rgba(255,255,255,0.15);
            padding: 8px 16px;
            border-radius: 50px;
            margin-right: 8px;
            cursor: pointer;
            transition: all 0.3s;
            border: 1.5px solid transparent;
        }
        
        .device-chip.active {
            background: #22c55e;
            border-color: white;
        }
        
        .device-chip .name {
            font-size: 0.85em;
            font-weight: 500;
        }
        
        .device-chip .status-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-left: 6px;
        }
        
        .device-chip .status-dot.streaming {
            background: #3b82f6;
            animation: pulse 1s infinite;
        }
        
        .device-chip .status-dot.online {
            background: #22c55e;
        }
        
        /* Video Container */
        .video-container {
            background: #000;
            border-radius: 15px;
            overflow: hidden;
            margin-bottom: 15px;
            aspect-ratio: 16/9;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        
        #streamImg {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        .video-placeholder {
            position: absolute;
            color: #666;
            font-size: 0.9em;
        }
        
        /* Stats Row */
        .stats-row {
            display: flex;
            justify-content: space-around;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .stat-box {
            flex: 1;
            background: rgba(0,0,0,0.3);
            padding: 10px;
            border-radius: 12px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 1.5em;
            font-weight: bold;
        }
        
        .stat-label {
            font-size: 0.7em;
            opacity: 0.8;
            margin-top: 4px;
        }
        
        /* Quality Section */
        .quality-section {
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
            padding: 12px;
            margin-bottom: 15px;
        }
        
        .quality-title {
            font-size: 0.85em;
            margin-bottom: 10px;
        }
        
        .quality-buttons {
            display: flex;
            gap: 10px;
        }
        
        .quality-btn {
            flex: 1;
            background: #1e293b;
            color: white;
            padding: 10px;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 0.85em;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .quality-btn.active {
            background: #22c55e;
        }
        
        /* Control Buttons */
        .control-buttons {
            display: flex;
            gap: 12px;
            margin-bottom: 15px;
        }
        
        .control-btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            transition: all 0.2s;
        }
        
        .control-btn:active {
            transform: scale(0.97);
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
            padding: 10px 20px;
            border-radius: 50px;
            z-index: 1000;
            font-size: 0.85em;
            white-space: nowrap;
            animation: fadeInUp 0.3s ease;
        }
        
        @keyframes fadeInUp {
            from {
                transform: translateX(-50%) translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
        
        /* No Device Message */
        .no-device-msg {
            text-align: center;
            padding: 40px 20px;
            opacity: 0.6;
            font-size: 0.9em;
        }
        
        /* Debug (hidden by default, show if needed) */
        .debug {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📷 Camera Controller</h1>
            <p>Live Stream from Android</p>
        </div>
        
        <div class="status-card">
            <div id="statusBadge" class="status-badge connecting">● CONNECTING...</div>
            <div class="connection-info" id="connectionInfo">Connecting to server...</div>
        </div>
        
        <!-- Device Selector (Horizontal Scroll) -->
        <div class="device-selector" id="deviceSelector" style="display: none;">
            <h3>📱 Select Device</h3>
            <div class="device-scroll" id="deviceList"></div>
        </div>
        
        <div id="noDeviceMsg" class="no-device-msg">
            ⚡ No device connected<br>
            <span style="font-size: 0.8em;">Start Android app to begin</span>
        </div>
        
        <!-- Video Section (Hidden initially) -->
        <div id="videoSection" style="display: none;">
            <div class="video-container">
                <img id="streamImg" src="" alt="Live Feed">
                <div class="video-placeholder" id="videoPlaceholder">📹 Waiting for stream...</div>
            </div>
            
            <div class="stats-row">
                <div class="stat-box">
                    <div class="stat-value" id="fps">0</div>
                    <div class="stat-label">FPS</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value" id="resolution">-</div>
                    <div class="stat-label">Resolution</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value" id="quality">-</div>
                    <div class="stat-label">Quality</div>
                </div>
            </div>
            
            <div class="quality-section">
                <div class="quality-title">🎨 Stream Quality</div>
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
    
    <script>
        const REPLIT_URL = window.location.origin;
        
        let socket;
        let currentDevice = null;
        let frameCount = 0;
        let lastTime = Date.now();
        let connectedDevices = new Map();
        let isStreaming = false;
        
        // DOM Elements
        const statusBadge = document.getElementById('statusBadge');
        const connectionInfo = document.getElementById('connectionInfo');
        const deviceSelector = document.getElementById('deviceSelector');
        const deviceListDiv = document.getElementById('deviceList');
        const noDeviceMsg = document.getElementById('noDeviceMsg');
        const videoSection = document.getElementById('videoSection');
        const streamImg = document.getElementById('streamImg');
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const fpsSpan = document.getElementById('fps');
        const resolutionSpan = document.getElementById('resolution');
        const qualitySpan = document.getElementById('quality');
        
        // FPS Counter
        function updateFPS() {
            const now = Date.now();
            if (now - lastTime >= 1000) {
                fpsSpan.textContent = frameCount;
                frameCount = 0;
                lastTime = now;
            }
            requestAnimationFrame(updateFPS);
        }
        updateFPS();
        
        function showToast(msg) {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
        
        function updateDeviceList() {
            if (connectedDevices.size === 0) {
                deviceSelector.style.display = 'none';
                noDeviceMsg.style.display = 'block';
                videoSection.style.display = 'none';
                currentDevice = null;
                return;
            }
            
            deviceSelector.style.display = 'block';
            noDeviceMsg.style.display = 'none';
            
            let html = '';
            connectedDevices.forEach((device, id) => {
                const isActive = currentDevice === id;
                const statusDotClass = device.streaming ? 'streaming' : 'online';
                html += \`
                    <div class="device-chip \${isActive ? 'active' : ''}" onclick="selectDevice('\${id}')">
                        <span class="name">\${device.name}</span>
                        <span class="status-dot \${statusDotClass}"></span>
                    </div>
                \`;
            });
            deviceListDiv.innerHTML = html;
            
            if (currentDevice && !connectedDevices.has(currentDevice)) {
                currentDevice = null;
                videoSection.style.display = 'none';
            } else if (currentDevice && !videoSection.style.display === 'none') {
                videoSection.style.display = 'block';
            }
        }
        
        function selectDevice(deviceId) {
            currentDevice = deviceId;
            const device = connectedDevices.get(deviceId);
            updateDeviceList();
            videoSection.style.display = 'block';
            videoPlaceholder.style.display = 'block';
            streamImg.src = '';
            resolutionSpan.textContent = '-';
            qualitySpan.textContent = '-';
            showToast(\`Connected to \${device.name}\`);
        }
        
        // Socket Connection
        function initSocket() {
            socket = io(REPLIT_URL, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 20,
                reconnectionDelay: 1000,
                timeout: 10000
            });
            
            socket.on('connect', () => {
                statusBadge.className = 'status-badge online';
                statusBadge.innerHTML = '● ONLINE';
                connectionInfo.innerHTML = 'Connected to server';
                showToast('Connected!');
            });
            
            socket.on('disconnect', () => {
                statusBadge.className = 'status-badge offline';
                statusBadge.innerHTML = '● OFFLINE';
                connectionInfo.innerHTML = 'Disconnected';
                videoSection.style.display = 'none';
            });
            
            socket.on('connect_error', () => {
                statusBadge.className = 'status-badge connecting';
                statusBadge.innerHTML = '● CONNECTING...';
            });
            
            socket.on('device_list_update', (devices) => {
                if (Array.isArray(devices)) {
                    connectedDevices.clear();
                    devices.forEach(d => connectedDevices.set(d.id, d));
                    updateDeviceList();
                }
            });
            
            socket.on('device_connected', (devices) => {
                if (Array.isArray(devices)) {
                    connectedDevices.clear();
                    devices.forEach(d => connectedDevices.set(d.id, d));
                } else if (devices && devices.id) {
                    connectedDevices.set(devices.id, devices);
                }
                updateDeviceList();
            });
            
            socket.on('device_disconnected', (deviceId) => {
                connectedDevices.delete(deviceId);
                if (currentDevice === deviceId) {
                    currentDevice = null;
                    videoSection.style.display = 'none';
                }
                updateDeviceList();
                showToast('Device disconnected');
            });
            
            socket.on('device_streaming', ({ deviceId, streaming }) => {
                if (connectedDevices.has(deviceId)) {
                    const device = connectedDevices.get(deviceId);
                    device.streaming = streaming;
                    connectedDevices.set(deviceId, device);
                    updateDeviceList();
                    if (currentDevice === deviceId && streaming) {
                        videoPlaceholder.style.display = 'none';
                    } else if (currentDevice === deviceId && !streaming) {
                        videoPlaceholder.style.display = 'block';
                        videoPlaceholder.innerHTML = '⏸ Stream stopped';
                    }
                }
            });
            
            socket.on('frame', (data) => {
                if (currentDevice) {
                    streamImg.src = data;
                    frameCount++;
                    videoPlaceholder.style.display = 'none';
                }
            });
            
            socket.on('resolution_update', ({ deviceId, width, height, quality }) => {
                if (currentDevice === deviceId) {
                    resolutionSpan.textContent = \`\${width}x\${height}\`;
                    qualitySpan.textContent = quality;
                }
            });
        }
        
        // Control Handlers (No stream stop)
        document.getElementById('startBtn')?.addEventListener('click', () => {
            if (!currentDevice) {
                showToast('Select a device first!');
                return;
            }
            socket.emit('command', 'start');
            showToast('Starting stream...');
            videoPlaceholder.innerHTML = '📹 Starting...';
        });
        
        document.getElementById('stopBtn')?.addEventListener('click', () => {
            if (!currentDevice) {
                showToast('Select a device first!');
                return;
            }
            socket.emit('command', 'stop');
            showToast('Stopping stream');
            videoPlaceholder.style.display = 'block';
            videoPlaceholder.innerHTML = '⏸ Stream stopped';
        });
        
        document.getElementById('flipBtn')?.addEventListener('click', () => {
            if (!currentDevice) {
                showToast('Select a device first!');
                return;
            }
            socket.emit('command', 'flip');
            showToast('🔄 Flipping camera...');
        });
        
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!currentDevice) {
                    showToast('Select a device first!');
                    return;
                }
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const quality = btn.dataset.quality;
                let width, height;
                if (quality === '140p') { width = 160; height = 140; }
                else if (quality === '240p') { width = 320; height = 240; }
                else { width = 480; height = 360; }
                socket.emit('quality', { quality, width, height });
                showToast(\`Quality: \${quality}\`);
            });
        });
        
        initSocket();
    </script>
</body>
</html>
`;

// Serve HTML
app.get('/', (req, res) => {
  res.send(htmlContent);
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  socket.on('register_device', (deviceInfo) => {
    devices.set(socket.id, {
      id: socket.id,
      name: deviceInfo.name,
      model: deviceInfo.model,
      streaming: false
    });
    console.log('📱 Device registered:', deviceInfo.name);
    io.emit('device_connected', Array.from(devices.values()));
    io.emit('device_list_update', Array.from(devices.values()));
  });
  
  // Forward frame to all web clients
  socket.on('frame', (data) => {
    socket.broadcast.emit('frame', data);
  });
  
  // Forward command to Android
  socket.on('command', (cmd) => {
    console.log('🎮 Command:', cmd);
    for (let [id, device] of devices) {
      const targetSocket = io.sockets.sockets.get(id);
      if (targetSocket) {
        targetSocket.emit('command', cmd);
      }
    }
  });
  
  // Forward quality to Android
  socket.on('quality', (qualityData) => {
    console.log('🎨 Quality:', qualityData);
    for (let [id, device] of devices) {
      const targetSocket = io.sockets.sockets.get(id);
      if (targetSocket) {
        targetSocket.emit('quality', qualityData);
      }
    }
  });
  
  socket.on('streaming_status', (status) => {
    if (devices.has(socket.id)) {
      const device = devices.get(socket.id);
      device.streaming = status;
      devices.set(socket.id, device);
      io.emit('device_streaming', { deviceId: socket.id, streaming: status });
    }
  });
  
  socket.on('resolution_update', (data) => {
    socket.broadcast.emit('resolution_update', { deviceId: socket.id, ...data });
  });
  
  socket.on('heartbeat', (data) => {
    console.log('💓 Heartbeat from:', socket.id);
  });
  
  socket.on('disconnect', () => {
    if (devices.has(socket.id)) {
      const device = devices.get(socket.id);
      console.log('❌ Device disconnected:', device.name);
      devices.delete(socket.id);
      io.emit('device_disconnected', socket.id);
      io.emit('device_list_update', Array.from(devices.values()));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log('📱 Mobile optimized UI ready');
  console.log('✨ Live flip & quality change (no stream stop)');
});
