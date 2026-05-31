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

// Store connected devices
const devices = new Map();

// Stylish HTML Stream Section
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Live Camera Stream</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            padding: 16px;
        }
        
        .stream-card {
            width: 100%;
            max-width: 550px;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(10px);
            border-radius: 32px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(34, 197, 94, 0.2);
        }
        
        /* Header */
        .stream-header {
            padding: 20px 20px 0 20px;
            text-align: center;
        }
        
        .stream-header h1 {
            font-size: 20px;
            font-weight: 600;
            background: linear-gradient(135deg, #22c55e, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.5px;
        }
        
        .stream-header p {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
        }
        
        /* Video Container */
        .video-wrapper {
            padding: 20px;
        }
        
        .video-container {
            background: #000000;
            border-radius: 24px;
            overflow: hidden;
            aspect-ratio: 16/9;
            position: relative;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(34, 197, 94, 0.3);
        }
        
        #streamImg {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        .placeholder {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #475569;
        }
        
        .placeholder-icon {
            font-size: 48px;
            margin-bottom: 12px;
            opacity: 0.5;
        }
        
        .placeholder-text {
            font-size: 13px;
            font-weight: 500;
        }
        
        /* Live Badge */
        .live-badge {
            position: absolute;
            top: 12px;
            left: 12px;
            background: #ef4444;
            padding: 4px 10px;
            border-radius: 30px;
            font-size: 10px;
            font-weight: 600;
            color: white;
            display: flex;
            align-items: center;
            gap: 6px;
            z-index: 10;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .live-dot {
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            animation: pulse 1s infinite;
        }
        
        /* Info Bar */
        .info-bar {
            padding: 16px 20px;
            background: rgba(0, 0, 0, 0.3);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid rgba(255,255,255,0.05);
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        
        .status-box {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
        }
        
        .status-dot.online {
            background: #22c55e;
            box-shadow: 0 0 8px #22c55e;
            animation: pulse 1.5s infinite;
        }
        
        .status-dot.offline {
            background: #ef4444;
        }
        
        .status-text {
            font-size: 13px;
            font-weight: 500;
            color: #cbd5e1;
        }
        
        .fps-box {
            background: rgba(34, 197, 94, 0.15);
            padding: 6px 14px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 600;
            color: #22c55e;
        }
        
        .fps-label {
            color: #94a3b8;
            margin-right: 4px;
        }
        
        /* Device Info */
        .device-info {
            padding: 12px 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background: rgba(0, 0, 0, 0.2);
        }
        
        .device-icon {
            font-size: 14px;
        }
        
        .device-name {
            font-size: 12px;
            color: #94a3b8;
            font-weight: 500;
        }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 16px 20px;
        }
        
        .stat-item {
            text-align: center;
            background: rgba(0, 0, 0, 0.2);
            padding: 10px;
            border-radius: 16px;
        }
        
        .stat-value {
            font-size: 18px;
            font-weight: 700;
            color: #22c55e;
        }
        
        .stat-label {
            font-size: 10px;
            color: #64748b;
            margin-top: 4px;
        }
        
        /* Animations */
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        @keyframes glow {
            0%, 100% { border-color: rgba(34, 197, 94, 0.3); }
            50% { border-color: rgba(34, 197, 94, 0.8); }
        }
        
        .video-container {
            animation: glow 2s infinite;
        }
        
        /* Responsive */
        @media (max-width: 480px) {
            .stream-card {
                border-radius: 24px;
            }
            .stats-grid {
                gap: 6px;
            }
            .stat-value {
                font-size: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="stream-card">
        <div class="stream-header">
            <h1>📷 LIVE CAMERA STREAM</h1>
            <p>Real-time video feed from your device</p>
        </div>
        
        <div class="video-wrapper">
            <div class="video-container">
                <div class="live-badge" id="liveBadge" style="display: none;">
                    <div class="live-dot"></div>
                    <span>LIVE</span>
                </div>
                <img id="streamImg" src="">
                <div class="placeholder" id="placeholder">
                    <div class="placeholder-icon">📹</div>
                    <div class="placeholder-text">Awaiting Stream...</div>
                </div>
            </div>
        </div>
        
        <div class="info-bar">
            <div class="status-box">
                <div class="status-dot offline" id="statusDot"></div>
                <span class="status-text" id="statusText">Offline</span>
            </div>
            <div class="fps-box">
                <span class="fps-label">FPS</span>
                <span id="fpsValue">0</span>
            </div>
        </div>
        
        <div class="device-info">
            <span class="device-icon">📱</span>
            <span class="device-name" id="deviceName">No device connected</span>
        </div>
        
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value" id="resolution">-</div>
                <div class="stat-label">Resolution</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="quality">-</div>
                <div class="stat-label">Quality</div>
            </div>
            <div class="stat-item">
                <div class="stat-value" id="bitrate">-</div>
                <div class="stat-label">Bitrate</div>
            </div>
        </div>
    </div>
    
    <script>
        const socket = io();
        
        let frameCount = 0;
        let lastTime = Date.now();
        let frameSize = 0;
        let totalBytes = 0;
        
        const streamImg = document.getElementById('streamImg');
        const placeholder = document.getElementById('placeholder');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const fpsValue = document.getElementById('fpsValue');
        const liveBadge = document.getElementById('liveBadge');
        const deviceNameSpan = document.getElementById('deviceName');
        const resolutionSpan = document.getElementById('resolution');
        const qualitySpan = document.getElementById('quality');
        const bitrateSpan = document.getElementById('bitrate');
        
        let bitrateTimer = 0;
        
        function updateFPS() {
            const now = Date.now();
            if (now - lastTime >= 1000) {
                fpsValue.textContent = frameCount;
                
                // Calculate bitrate (KB/s)
                let bitrate = (totalBytes / 1024).toFixed(0);
                bitrateSpan.textContent = bitrate + ' KB/s';
                
                frameCount = 0;
                totalBytes = 0;
                lastTime = now;
            }
            requestAnimationFrame(updateFPS);
        }
        updateFPS();
        
        socket.on('connect', () => {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Live';
        });
        
        socket.on('disconnect', () => {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Offline';
            liveBadge.style.display = 'none';
            placeholder.style.display = 'flex';
            deviceNameSpan.textContent = 'No device connected';
        });
        
        socket.on('device_list_update', (devices) => {
            if (devices && devices.length > 0) {
                deviceNameSpan.textContent = devices[0].name;
            }
        });
        
        socket.on('frame', (data) => {
            if (data) {
                streamImg.src = data;
                frameCount++;
                placeholder.style.display = 'none';
                liveBadge.style.display = 'flex';
                
                // Calculate frame size
                const base64Data = data.split(',')[1];
                if (base64Data) {
                    const size = Math.round(base64Data.length * 0.75);
                    totalBytes += size;
                }
            }
        });
        
        socket.on('resolution_update', (data) => {
            if (data && data.width && data.height) {
                resolutionSpan.textContent = data.width + 'x' + data.height;
                qualitySpan.textContent = data.quality || '240p';
            }
        });
    </script>
</body>
</html>`;

// Serve HTML page
app.get('/', (req, res) => {
  res.send(htmlContent);
});

// Command endpoint for Vercel
app.post('/command', express.json(), (req, res) => {
  const { command, quality, width, height } = req.body;
  console.log('📨 Command:', command);
  
  if (command === 'start' || command === 'stop' || command === 'flip') {
    for (let [id] of devices) {
      const targetSocket = io.sockets.sockets.get(id);
      if (targetSocket) targetSocket.emit('command', command);
    }
  }
  
  if (command === 'quality' && quality) {
    for (let [id] of devices) {
      const targetSocket = io.sockets.sockets.get(id);
      if (targetSocket) targetSocket.emit('quality', { quality, width, height });
    }
  }
  
  res.json({ success: true });
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  socket.on('register_device', (deviceInfo) => {
    devices.set(socket.id, {
      id: socket.id,
      name: deviceInfo.name,
      model: deviceInfo.model
    });
    console.log('📱 Device:', deviceInfo.name);
    io.emit('device_list_update', Array.from(devices.values()));
  });
  
  socket.on('frame', (data) => {
    socket.broadcast.emit('frame', data);
  });
  
  socket.on('resolution_update', (data) => {
    socket.broadcast.emit('resolution_update', data);
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
  console.log(`🚀 Server running on port ${PORT}`);
});
