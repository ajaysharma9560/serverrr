const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  } 
});

// Store devices
const devices = new Map();

// Mobile Optimized HTML - Modern Dark UI
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="theme-color" content="#0f172a">
    <title>Camera Controller</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            background: #0f172a;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 16px;
            min-height: 100vh;
        }

        /* Main Container */
        .container {
            max-width: 500px;
            margin: 0 auto;
        }

        /* Header */
        .header {
            text-align: center;
            margin-bottom: 24px;
        }

        .header h1 {
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 4px;
        }

        .header p {
            font-size: 14px;
            color: #94a3b8;
        }

        /* Connection Status */
        .status-container {
            background: #1e293b;
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: center;
            border: 1px solid #334155;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 16px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
        }

        .status-dot.online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
        .status-dot.offline { background: #ef4444; animation: none; }
        .status-dot.connecting { background: #f59e0b; }

        .status-text {
            font-size: 13px;
            color: #94a3b8;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Device Section */
        .device-section {
            background: #1e293b;
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #94a3b8;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .device-list {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding-bottom: 4px;
        }

        .device-list::-webkit-scrollbar {
            height: 3px;
        }

        .device-list::-webkit-scrollbar-track {
            background: #334155;
            border-radius: 10px;
        }

        .device-list::-webkit-scrollbar-thumb {
            background: #22c55e;
            border-radius: 10px;
        }

        .device-card {
            background: #0f172a;
            border-radius: 16px;
            padding: 12px 18px;
            min-width: 130px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1.5px solid #334155;
        }

        .device-card.active {
            border-color: #22c55e;
            background: rgba(34, 197, 94, 0.1);
        }

        .device-name {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 6px;
        }

        .device-status {
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .streaming-badge {
            color: #3b82f6;
        }

        .online-badge {
            color: #22c55e;
        }

        .no-device {
            text-align: center;
            padding: 30px;
            color: #64748b;
        }

        /* Video Section */
        .video-section {
            background: #1e293b;
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }

        .video-container {
            background: #000000;
            border-radius: 16px;
            overflow: hidden;
            aspect-ratio: 16/9;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            position: relative;
        }

        #streamImg {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .video-placeholder {
            position: absolute;
            color: #475569;
            font-size: 14px;
            text-align: center;
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: #0f172a;
            border-radius: 14px;
            padding: 12px;
            text-align: center;
        }

        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #22c55e;
        }

        .stat-label {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
        }

        /* Quality Section */
        .quality-section {
            margin-bottom: 20px;
        }

        .quality-title {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 10px;
        }

        .quality-buttons {
            display: flex;
            gap: 12px;
        }

        .quality-btn {
            flex: 1;
            background: #0f172a;
            border: 1px solid #334155;
            color: white;
            padding: 12px;
            border-radius: 40px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .quality-btn.active {
            background: #22c55e;
            border-color: #22c55e;
        }

        /* Control Buttons */
        .control-buttons {
            display: flex;
            gap: 12px;
        }

        .control-btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 40px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
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
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            border: 1px solid #334155;
            color: white;
            padding: 10px 20px;
            border-radius: 40px;
            font-size: 13px;
            z-index: 1000;
            white-space: nowrap;
            animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }

        /* Hidden */
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>📷 Camera Controller</h1>
            <p>Live Stream from Android</p>
        </div>

        <!-- Connection Status -->
        <div class="status-container">
            <div class="status-badge" id="statusBadge">
                <div class="status-dot connecting"></div>
                <span>CONNECTING...</span>
            </div>
            <div class="status-text" id="connectionText">Connecting to server...</div>
        </div>

        <!-- Device Section -->
        <div class="device-section">
            <div class="section-title">
                <span>📱</span> Connected Devices
                <span id="deviceCount" style="color:#22c55e;">(0)</span>
            </div>
            <div id="deviceList" class="device-list">
                <div class="no-device">⚠️ No device connected<br>Start Android app to begin</div>
            </div>
        </div>

        <!-- Video Section (Hidden initially) -->
        <div id="videoSection" class="video-section hidden">
            <div class="video-container">
                <img id="streamImg" src="">
                <div class="video-placeholder" id="videoPlaceholder">📹 Waiting for stream...</div>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="fps">0</div>
                    <div class="stat-label">FPS</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="resolution">-</div>
                    <div class="stat-label">Resolution</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="qualityLabel">-</div>
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
        const socket = io();
        
        let currentDevice = null;
        let frameCount = 0;
        let lastTime = Date.now();
        let connectedDevices = new Map();

        // DOM Elements
        const statusBadge = document.getElementById('statusBadge');
        const connectionText = document.getElementById('connectionText');
        const deviceListDiv = document.getElementById('deviceList');
        const deviceCountSpan = document.getElementById('deviceCount');
        const videoSection = document.getElementById('videoSection');
        const streamImg = document.getElementById('streamImg');
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const fpsSpan = document.getElementById('fps');
        const resolutionSpan = document.getElementById('resolution');
        const qualityLabelSpan = document.getElementById('qualityLabel');

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

        function updateDeviceUI() {
            if (connectedDevices.size === 0) {
                deviceListDiv.innerHTML = '<div class="no-device">⚠️ No device connected<br>Start Android app to begin</div>';
                deviceCountSpan.textContent = '(0)';
                videoSection.classList.add('hidden');
                currentDevice = null;
                return;
            }

            deviceCountSpan.textContent = `(${connectedDevices.size})`;
            
            let html = '';
            connectedDevices.forEach((device, id) => {
                const isActive = currentDevice === id;
                const statusClass = device.streaming ? 'streaming-badge' : 'online-badge';
                const statusText = device.streaming ? '🔵 Streaming' : '🟢 Online';
                
                html += `
                    <div class="device-card ${isActive ? 'active' : ''}" onclick="selectDevice('${id}')">
                        <div class="device-name">${device.name.length > 15 ? device.name.substring(0,12)+'...' : device.name}</div>
                        <div class="device-status">
                            <span class="${statusClass}">${statusText}</span>
                        </div>
                    </div>
                `;
            });
            deviceListDiv.innerHTML = html;
        }

        function selectDevice(deviceId) {
            currentDevice = deviceId;
            const device = connectedDevices.get(deviceId);
            updateDeviceUI();
            videoSection.classList.remove('hidden');
            streamImg.src = '';
            videoPlaceholder.style.display = 'flex';
            videoPlaceholder.textContent = '📹 Waiting for stream...';
            resolutionSpan.textContent = '-';
            qualityLabelSpan.textContent = '-';
            showToast(`📱 Connected to ${device.name}`);
        }

        // Socket Events
        socket.on('connect', () => {
            statusBadge.innerHTML = '<div class="status-dot online"></div><span>ONLINE</span>';
            connectionText.textContent = 'Connected to server';
            showToast('✅ Connected to server');
        });

        socket.on('disconnect', () => {
            statusBadge.innerHTML = '<div class="status-dot offline"></div><span>OFFLINE</span>';
            connectionText.textContent = 'Disconnected from server';
            videoSection.classList.add('hidden');
        });

        socket.on('connect_error', () => {
            statusBadge.innerHTML = '<div class="status-dot connecting"></div><span>CONNECTING...</span>';
            connectionText.textContent = 'Connecting to server...';
        });

        socket.on('device_list_update', (devices) => {
            if (Array.isArray(devices)) {
                connectedDevices.clear();
                devices.forEach(d => connectedDevices.set(d.id, d));
                updateDeviceUI();
            }
        });

        socket.on('device_connected', (devices) => {
            if (Array.isArray(devices)) {
                connectedDevices.clear();
                devices.forEach(d => connectedDevices.set(d.id, d));
            } else if (devices && devices.id) {
                connectedDevices.set(devices.id, devices);
            }
            updateDeviceUI();
            showToast('📱 New device connected!');
        });

        socket.on('device_disconnected', (deviceId) => {
            connectedDevices.delete(deviceId);
            if (currentDevice === deviceId) {
                currentDevice = null;
                videoSection.classList.add('hidden');
            }
            updateDeviceUI();
            showToast('❌ Device disconnected');
        });

        socket.on('device_streaming', ({ deviceId, streaming }) => {
            if (connectedDevices.has(deviceId)) {
                const device = connectedDevices.get(deviceId);
                device.streaming = streaming;
                connectedDevices.set(deviceId, device);
                updateDeviceUI();
                if (currentDevice === deviceId && streaming) {
                    videoPlaceholder.style.display = 'none';
                } else if (currentDevice === deviceId && !streaming) {
                    videoPlaceholder.style.display = 'flex';
                    videoPlaceholder.textContent = '⏸ Stream stopped';
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
                resolutionSpan.textContent = `${width}x${height}`;
                qualityLabelSpan.textContent = quality;
            }
        });

        // Controls
        document.getElementById('startBtn')?.addEventListener('click', () => {
            if (!currentDevice) { showToast('Select a device first!'); return; }
            socket.emit('command', 'start');
            showToast('▶ Starting stream...');
            videoPlaceholder.textContent = '📹 Starting...';
        });

        document.getElementById('stopBtn')?.addEventListener('click', () => {
            if (!currentDevice) { showToast('Select a device first!'); return; }
            socket.emit('command', 'stop');
            showToast('⏹ Stopping stream');
            videoPlaceholder.style.display = 'flex';
            videoPlaceholder.textContent = '⏸ Stream stopped';
        });

        document.getElementById('flipBtn')?.addEventListener('click', () => {
            if (!currentDevice) { showToast('Select a device first!'); return; }
            socket.emit('command', 'flip');
            showToast('🔄 Flipping camera...');
        });

        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!currentDevice) { showToast('Select a device first!'); return; }
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const quality = btn.dataset.quality;
                let width, height;
                if (quality === '140p') { width = 160; height = 140; }
                else if (quality === '240p') { width = 320; height = 240; }
                else { width = 480; height = 360; }
                socket.emit('quality', { quality, width, height });
                showToast(`🎨 Quality: ${quality}`);
            });
        });
    </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(htmlContent);
});

// Socket Events
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  socket.on('register_device', (deviceInfo) => {
    devices.set(socket.id, {
      id: socket.id,
      name: deviceInfo.name,
      model: deviceInfo.model,
      streaming: false
    });
    console.log('📱 Device:', deviceInfo.name);
    io.emit('device_list_update', Array.from(devices.values()));
  });
  
  socket.on('frame', (data) => {
    socket.broadcast.emit('frame', data);
  });
  
  socket.on('command', (cmd) => {
    console.log('🎮 Command:', cmd);
    for (let [id] of devices) {
      const target = io.sockets.sockets.get(id);
      if (target) target.emit('command', cmd);
    }
  });
  
  socket.on('quality', (data) => {
    console.log('🎨 Quality:', data);
    for (let [id] of devices) {
      const target = io.sockets.sockets.get(id);
      if (target) target.emit('quality', data);
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
  
  socket.on('disconnect', () => {
    if (devices.has(socket.id)) {
      console.log('❌ Device disconnected:', devices.get(socket.id).name);
      devices.delete(socket.id);
      io.emit('device_list_update', Array.from(devices.values()));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server on port ${PORT}`);
  console.log('📱 Mobile optimized UI ready');
});
