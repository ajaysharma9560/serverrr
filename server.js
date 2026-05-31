const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store connected devices
const devices = new Map();

// ============================================
// HTML STREAM PAGE - Sirf Stream (Koi Button Nahi)
// ============================================
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
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .container {
            width: 100%;
            max-width: 500px;
            background: #000;
        }
        .video-container {
            aspect-ratio: 16/9;
            background: #1a1a1a;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .video-container img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .info {
            padding: 12px;
            text-align: center;
            background: #0f0f0f;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #222;
        }
        .fps {
            color: #22c55e;
            font-weight: 600;
        }
        .status {
            color: #22c55e;
        }
        .device-name {
            color: #555;
            margin-top: 5px;
            font-size: 11px;
        }
        .placeholder {
            position: absolute;
            text-align: center;
            color: #475569;
        }
        .placeholder-icon {
            font-size: 48px;
            margin-bottom: 8px;
        }
        .live-badge {
            position: absolute;
            top: 12px;
            left: 12px;
            background: rgba(0,0,0,0.7);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            color: #ef4444;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .live-dot {
            width: 8px;
            height: 8px;
            background: #ef4444;
            border-radius: 50%;
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="video-container">
            <img id="streamImg">
            <div class="placeholder" id="placeholder">
                <div class="placeholder-icon">📹</div>
                <div>Waiting for stream...</div>
            </div>
            <div class="live-badge" id="liveBadge" style="display: none;">
                <div class="live-dot"></div>
                <span>LIVE</span>
            </div>
        </div>
        <div class="info">
            <span>📡 Status: </span><span class="status" id="status">Connecting...</span>
            <span style="margin:0 8px">|</span>
            <span>FPS: </span><span class="fps" id="fps">0</span>
        </div>
        <div class="device-name" id="deviceName">Waiting for device...</div>
    </div>

    <script>
        const socket = io();
        
        let frameCount = 0;
        let lastTime = Date.now();
        
        const streamImg = document.getElementById('streamImg');
        const placeholder = document.getElementById('placeholder');
        const liveBadge = document.getElementById('liveBadge');
        const statusSpan = document.getElementById('status');
        const fpsSpan = document.getElementById('fps');
        const deviceNameSpan = document.getElementById('deviceName');
        
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
        
        socket.on('connect', () => {
            statusSpan.textContent = 'Live';
            statusSpan.style.color = '#22c55e';
        });
        
        socket.on('disconnect', () => {
            statusSpan.textContent = 'Offline';
            statusSpan.style.color = '#ef4444';
            liveBadge.style.display = 'none';
            placeholder.style.display = 'flex';
        });
        
        socket.on('device_list_update', (devices) => {
            if (devices && devices.length > 0) {
                deviceNameSpan.textContent = devices[0].name;
            } else {
                deviceNameSpan.textContent = 'No device connected';
            }
        });
        
        socket.on('frame', (data) => {
            if (data) {
                streamImg.src = data;
                frameCount++;
                placeholder.style.display = 'none';
                liveBadge.style.display = 'flex';
            }
        });
        
        socket.on('resolution_update', (data) => {
            if (data) {
                console.log('📐 Resolution:', data.width + 'x' + data.height, data.quality);
            }
        });
    </script>
</body>
</html>`;

// Serve HTML page (Sirf Stream - No Buttons)
app.get('/', (req, res) => {
  res.send(htmlContent);
});

// ============================================
// COMMAND ENDPOINT - Vercel Se Commands Yahan Aayengi
// ============================================
app.post('/command', (req, res) => {
  const { command, quality, width, height } = req.body;
  
  console.log('📨 Command received from Vercel:', command);
  
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }
  
  // Forward command to all connected Android devices
  let sentCount = 0;
  for (let [id, device] of devices) {
    const targetSocket = io.sockets.sockets.get(id);
    if (targetSocket) {
      if (command === 'start' || command === 'stop' || command === 'flip') {
        targetSocket.emit('command', command);
        sentCount++;
        console.log(`✅ Command "${command}" sent to ${device.name}`);
      } else if (command === 'quality' && quality) {
        targetSocket.emit('quality', { quality, width, height });
        sentCount++;
        console.log(`✅ Quality "${quality}" sent to ${device.name}`);
      }
    }
  }
  
  if (sentCount > 0) {
    res.json({ success: true, command: command, devices: sentCount });
  } else {
    console.log('⚠️ No device connected');
    res.json({ success: false, error: 'No device connected' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', devices: devices.size });
});

// ============================================
// SOCKET EVENTS
// ============================================
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  // Register device (Android app)
  socket.on('register_device', (data) => {
    devices.set(socket.id, {
      id: socket.id,
      name: data?.name || data?.device_name || 'Android Device',
      model: data?.model || 'Unknown'
    });
    console.log('📱 Device registered:', devices.get(socket.id).name);
    console.log('Total devices:', devices.size);
    
    // Broadcast to all web clients
    io.emit('device_list_update', Array.from(devices.values()));
  });

  // Receive frame from Android and broadcast to web
  socket.on('frame', (data) => {
    socket.broadcast.emit('frame', data);
  });

  // Receive resolution update
  socket.on('resolution_update', (data) => {
    socket.broadcast.emit('resolution_update', data);
  });

  // Streaming status
  socket.on('streaming_status', (status) => {
    console.log('📡 Streaming status:', status);
  });

  // Heartbeat
  socket.on('heartbeat', (data) => {
    // Keep connection alive
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    if (devices.has(socket.id)) {
      console.log('Device removed:', devices.get(socket.id).name);
      devices.delete(socket.id);
      io.emit('device_list_update', Array.from(devices.values()));
    }
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📺 Stream URL: http://localhost:${PORT}`);
  console.log(`📨 Command endpoint: POST /command`);
  console.log(`✅ Streaming only page - No buttons`);
});
