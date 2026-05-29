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

const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
            padding: 20px 16px;
            min-height: 100vh;
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

        .header h1 {
            font-size: 26px;
            font-weight: 700;
            background: linear-gradient(135deg, #22c55e, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 4px;
        }

        .header p {
            font-size: 13px;
            color: #64748b;
        }

        /* Device Status Card */
        .device-status-card {
            background: #1e293b;
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
            border: 1px solid #334155;
            text-align: center;
        }

        .device-name-large {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .status-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 500;
        }

        .status-offline {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }

        .status-online {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
        }

        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .dot-offline { background: #ef4444; }
        .dot-online { background: #22c55e; animation: pulse 1.5s infinite; }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Device Selector */
        .device-selector {
            background: #1e293b;
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }

        .section-title {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .device-scroll {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            padding-bottom: 4px;
        }

        .device-scroll::-webkit-scrollbar {
            height: 3px;
        }

        .device-scroll::-webkit-scrollbar-track {
            background: #334155;
            border-radius: 10px;
        }

        .device-scroll::-webkit-scrollbar-thumb {
            background: #22c55e;
            border-radius: 10px;
        }

        .device-chip {
            background: #0f172a;
            border: 1.5px solid #334155;
            border-radius: 40px;
            padding: 8px 18px;
            white-space: nowrap;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
            font-weight: 500;
        }

        .device-chip.active {
            border-color: #22c55e;
            background: rgba(34, 197, 94, 0.1);
        }

        /* Live Feed Section */
        .live-feed {
            background: #1e293b;
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }

        .feed-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .feed-title {
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .fps-badge {
            background: #0f172a;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            color: #22c55e;
        }

        /* Video Container */
        .video-container {
            background: #000000;
            border-radius: 16px;
            overflow: hidden;
            aspect-ratio: 16/9;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            margin-bottom: 12px;
        }

        #streamImg {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .video-placeholder {
            position: absolute;
            text-align: center;
            color: #475569;
        }

        .placeholder-icon {
            font-size: 48px;
            margin-bottom: 8px;
        }

        .placeholder-text {
            font-size: 13px;
        }

        /* Stream Info */
        .stream-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 12px;
            background: #0f172a;
            border-radius: 12px;
        }

        .info-item {
            text-align: center;
        }

        .info-label {
            font-size: 10px;
            color: #64748b;
            margin-bottom: 2px;
        }

        .info-value {
            font-size: 14px;
            font-weight: 600;
            color: #22c55e;
        }

        /* Quality Section */
        .quality-section {
            background: #1e293b;
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 20px;
            border: 1px solid #334155;
        }

        .quality-buttons {
            display: flex;
            gap: 12px;
            margin-top: 10px;
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
            text-align: center;
        }

        .quality-btn.active {
            background: #22c55e;
            border-color: #22c55e;
        }

        /* Control Buttons */
        .control-buttons {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
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

        /* No Device Message */
        .no-device-msg {
            text-align: center;
            padding: 40px 20px;
            color: #64748b;
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
            <p>Firebase Controlled Camera</p>
        </div>

        <!-- Device Status -->
        <div class="device-status-card">
            <div class="device-name-large" id="deviceName">No Device</div>
            <div class="status-indicator" id="deviceStatus">
                <div class="dot dot-offline"></div>
                <span>Device Offline</span>
            </div>
        </div>

        <!-- Device Selector -->
        <div class="device-selector" id="deviceSelector">
            <div class="section-title">
                <span>📱</span> Connected Devices
                <span id="deviceCount" style="color:#22c55e;">(0)</span>
            </div>
            <div class="device-scroll" id="deviceList">
                <div class="no-device-msg">No device connected</div>
            </div>
        </div>

        <!-- Live Feed Section -->
        <div class="live-feed" id="liveFeed">
            <div class="feed-header">
                <div class="feed-title">
                    <span>📺</span> Live Feed
                </div>
                <div class="fps-badge" id="fpsDisplay">0 FPS</div>
            </div>
            
            <div class="video-container">
                <img id="streamImg" src="" alt="Live Feed">
                <div class="video-placeholder" id="videoPlaceholder">
                    <div class="placeholder-icon">📷</div>
                    <div class="placeholder-text">No active stream</div>
                </div>
            </div>
            
            <div class="stream-info">
                <div class="info-item">
                    <div class="info-label">Resolution</div>
                    <div class="info-value" id="resolution">-</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Bitrate</div>
                    <div class="info-value" id="bitrate">-</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Quality</div>
                    <div class="info-value" id="qualityText">240p</div>
                </div>
            </div>
        </div>

        <!-- Stream Quality -->
        <div class="quality-section">
            <div class="section-title">🎨 Stream Quality</div>
            <div class="quality-buttons">
                <button class="quality-btn" data-quality="140p">140p</button>
                <button class="quality-btn active" data-quality="240p">240p</button>
                <button class="quality-btn" data-quality="360p">360p</button>
            </div>
        </div>

        <!-- Camera Control -->
        <div class="control-buttons">
            <button class="control-btn btn-start" id="startBtn">▶ START</button>
            <button class="control-btn btn-stop" id="stopBtn">⏹ STOP</button>
            <button class="control-btn btn-flip" id="flipBtn">🔄 FLIP</button>
        </div>
    </div>

    <script>
        const socket = io();
        
        let currentDevice = null;
        let frameCount = 0;
        let lastTime = Date.now();
        let connectedDevices = new Map();
        let frameInterval = null;

        // DOM Elements
        const deviceNameSpan = document.getElementById('deviceName');
        const deviceStatusDiv = document.getElementById('deviceStatus');
        const deviceListDiv = document.getElementById('deviceList');
        const deviceCountSpan = document.getElementById('deviceCount');
        const streamImg = document.getElementById('streamImg');
        const videoPlaceholder = document.getElementById('videoPlaceholder');
        const fpsDisplay = document.getElementById('fpsDisplay');
        const resolutionSpan = document.getElementById('resolution');
        const qualityTextSpan = document.getElementById('qualityText');

        // FPS Counter
        function startFPSMonitor() {
            if (frameInterval) clearInterval(frameInterval);
            frameInterval = setInterval(() => {
                fpsDisplay.textContent = frameCount + ' FPS';
                frameCount = 0;
            }, 1000);
        }
        startFPSMonitor();

        function showToast(msg) {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }

        function updateDeviceUI() {
            if (connectedDevices.size === 0) {
                deviceListDiv.innerHTML = '<div class="no-device-msg">⚠️ No device connected</div>';
                deviceCountSpan.textContent = '(0)';
                if (!currentDevice) {
                    deviceNameSpan.textContent = 'No Device';
                    deviceStatusDiv.innerHTML = '<div class="dot dot-offline"></div><span>Device Offline</span>';
                    deviceStatusDiv.className = 'status-indicator status-offline';
                }
                return;
            }

            deviceCountSpan.textContent = `(${connectedDevices.size})`;
            
            let html = '';
            connectedDevices.forEach((device, id) => {
                const isActive = currentDevice === id;
                html += `<div class="device-chip ${isActive ? 'active' : ''}" onclick="selectDevice('${id}')">${device.name}</div>`;
            });
            deviceListDiv.innerHTML = html;
        }

        function selectDevice(deviceId) {
            currentDevice = deviceId;
            const device = connectedDevices.get(deviceId);
            
            deviceNameSpan.textContent = device.name;
            deviceStatusDiv.innerHTML = '<div class="dot dot-online"></div><span>Device Online</span>';
            deviceStatusDiv.className = 'status-indicator status-online';
            
            updateDeviceUI();
            
            // Reset video
            streamImg.src = '';
            videoPlaceholder.style.display = 'flex';
            resolutionSpan.textContent = '-';
            
            showToast(`📱 Connected to ${device.name}`);
        }

        // Socket Events
        socket.on('connect', () => {
            showToast('✅ Connected to server');
        });

        socket.on('disconnect', () => {
            deviceNameSpan.textContent = 'No Device';
            deviceStatusDiv.innerHTML = '<div class="dot dot-offline"></div><span>Device Offline</span>';
            deviceStatusDiv.className = 'status-indicator status-offline';
            videoPlaceholder.style.display = 'flex';
            showToast('❌ Disconnected');
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
                deviceNameSpan.textContent = 'No Device';
                deviceStatusDiv.innerHTML = '<div class="dot dot-offline"></div><span>Device Offline</span>';
                deviceStatusDiv.className = 'status-indicator status-offline';
                videoPlaceholder.style.display = 'flex';
                streamImg.src = '';
                resolutionSpan.textContent = '-';
            }
            updateDeviceUI();
            showToast('❌ Device disconnected');
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
                qualityTextSpan.textContent = quality;
            }
        });

        // Controls
        document.getElementById('startBtn').addEventListener('click', () => {
            if (!currentDevice) { showToast('Select a device first!'); return; }
            socket.emit('command', 'start');
            showToast('▶ Starting stream...');
            videoPlaceholder.style.display = 'flex';
            videoPlaceholder.innerHTML = '<div class="placeholder-icon">⏳</div><div class="placeholder-text">Starting stream...</div>';
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            if (!currentDevice) { showToast('Select a device first!'); return; }
            socket.emit('command', 'stop');
            showToast('⏹ Stopping stream');
            videoPlaceholder.style.display = 'flex';
            videoPlaceholder.innerHTML = '<div class="placeholder-icon">⏸</div><div class="placeholder-text">Stream stopped</div>';
            streamImg.src = '';
        });

        document.getElementById('flipBtn').addEventListener('click', () => {
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
  console.log('📱 Mobile optimized UI with Live Feed section');
});
