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

// HTML - Sirf Stream Video (No Controls)
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Live Camera Stream</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: #000000;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .stream-container {
            width: 100%;
            max-width: 500px;
            background: #000;
        }
        
        .video-box {
            aspect-ratio: 16/9;
            background: #1a1a1a;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        
        .video-box img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        .placeholder {
            position: absolute;
            text-align: center;
            color: #666;
        }
        
        .placeholder-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }
        
        .info-bar {
            padding: 12px 16px;
            background: #0f0f0f;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid #222;
        }
        
        .status-box {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        
        .status-dot.online {
            background: #22c55e;
            animation: pulse 1.5s infinite;
        }
        
        .status-dot.offline {
            background: #ef4444;
        }
        
        .status-text {
            color: #888;
        }
        
        .fps-box {
            font-size: 12px;
            color: #888;
        }
        
        .fps-value {
            color: #22c55e;
            font-weight: 600;
        }
        
        .device-name {
            font-size: 11px;
            color: #555;
            text-align: center;
            padding: 8px;
            background: #0a0a0a;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="stream-container">
        <div class="video-box">
            <img id="streamImg" src="">
            <div class="placeholder" id="placeholder">
                <div class="placeholder-icon">📹</div>
                <div>Waiting for stream...</div>
            </div>
        </div>
        
        <div class="info-bar">
            <div class="status-box">
                <div class="status-dot offline" id="statusDot"></div>
                <span class="status-text" id="statusText">Connecting...</span>
            </div>
            <div class="fps-box">
                <span>FPS: </span>
                <span class="fps-value" id="fpsValue">0</span>
            </div>
        </div>
        
        <div class="device-name" id="deviceName"></div>
    </div>
    
    <script>
        const socket = io();
        
        let frameCount = 0;
        let lastTime = Date.now();
        let currentDevice = null;
        
        const streamImg = document.getElementById('streamImg');
        const placeholder = document.getElementById('placeholder');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const fpsValue = document.getElementById('fpsValue');
        const deviceNameSpan = document.getElementById('deviceName');
        
        // FPS Counter
        function updateFPS() {
            const now = Date.now();
            if (now - lastTime >= 1000) {
                fpsValue.textContent = frameCount;
                frameCount = 0;
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
            placeholder.style.display = 'flex';
        });
        
        socket.on('connect_error', () => {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Connecting...';
        });
        
        // Device list update
        socket.on('device_list_update', (devices) => {
            if (devices && devices.length > 0) {
                const device = devices[0];
                currentDevice = device.id;
                deviceNameSpan.textContent = device.name;
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Live';
            }
        });
        
        socket.on('device_connected', (devices) => {
            if (devices && devices.length > 0) {
                const device = devices[0];
                currentDevice = device.id;
                deviceNameSpan.textContent = device.name;
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Live';
            } else if (devices && devices.id) {
                currentDevice = devices.id;
                deviceNameSpan.textContent = devices.name;
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Live';
            }
        });
        
        socket.on('device_disconnected', () => {
            deviceNameSpan.textContent = '';
            placeholder.style.display = 'flex';
        });
        
        // Receive frame
        socket.on('frame', (data) => {
            if (data) {
                streamImg.src = data;
                frameCount++;
                placeholder.style.display = 'none';
            }
        });
    </script>
</body>
</html>`;

// Serve HTML
app.get('/', (req, res) => {
  res.send(htmlContent);
});

// Socket events
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  // Register device (Android app)
  socket.on('register_device', (deviceInfo) => {
    devices.set(socket.id, {
      id: socket.id,
      name: deviceInfo.name,
      model: deviceInfo.model,
      streaming: false
    });
    console.log('📱 Device registered:', deviceInfo.name);
    io.emit('device_list_update', Array.from(devices.values()));
    io.emit('device_connected', Array.from(devices.values()));
  });
  
  // Forward frame to all web clients
  socket.on('frame', (data) => {
    socket.broadcast.emit('frame', data);
  });
  
  // Forward resolution update
  socket.on('resolution_update', (data) => {
    socket.broadcast.emit('resolution_update', data);
  });
  
  // Heartbeat
  socket.on('heartbeat', (data) => {
    // Keep alive
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    if (devices.has(socket.id)) {
      console.log('❌ Device disconnected:', devices.get(socket.id).name);
      devices.delete(socket.id);
      io.emit('device_list_update', Array.from(devices.values()));
      io.emit('device_disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📺 Stream URL: http://localhost:${PORT}`);
  console.log(`✅ No controls - Only stream display`);
});
