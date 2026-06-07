const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

let devices = [];
let isStreaming = false;
let quality = 240;
let fps = 15;

io.on('connection', (socket) => {
  console.log('📱 Connected:', socket.id);
  
  // Device register
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || "Android Device",
      model: data.model || "Unknown",
      online: true,
      time: new Date().toLocaleTimeString()
    };
    
    devices.push(device);
    console.log(`✅ Device: ${device.name}`);
    
    io.emit('devices_list', devices);
    io.emit('status', { devices: devices.length, streaming: isStreaming, quality: quality, fps: fps });
  });
  
  // Receive frame
  socket.on('stream_frame', (data) => {
    if (data && data.image && isStreaming) {
      io.emit('frame', { image: data.image, fps: fps });
    }
  });
  
  // Commands from web
  socket.on('command', (data) => {
    const { command, value } = data;
    console.log(`🎮 ${command} ${value || ''}`);
    
    if (command === 'start') isStreaming = true;
    if (command === 'stop') isStreaming = false;
    if (command === 'quality') quality = value;
    if (command === 'fps') fps = value;
    
    // Send command to device
    devices.forEach(d => io.to(d.id).emit('command', { command, value }));
    
    io.emit('status', { devices: devices.length, streaming: isStreaming, quality: quality, fps: fps });
  });
  
  socket.on('disconnect', () => {
    devices = devices.filter(d => d.id !== socket.id);
    io.emit('devices_list', devices);
    io.emit('status', { devices: devices.length, streaming: isStreaming, quality: quality, fps: fps });
    console.log(`❌ Disconnected`);
  });
  
  socket.emit('devices_list', devices);
  socket.emit('status', { devices: devices.length, streaming: isStreaming, quality: quality, fps: fps });
});

// Web Interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Ludoo Remote</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a;
            padding: 20px;
            color: #fff;
        }
        .container { max-width: 600px; margin: 0 auto; }
        
        /* Header */
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 26px; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        
        /* Stats */
        .stats { display: flex; gap: 12px; margin-bottom: 20px; }
        .stat-card { flex: 1; background: #1a1a1a; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #2a2a2a; }
        .stat-label { font-size: 11px; color: #888; margin-bottom: 5px; }
        .stat-value { font-size: 22px; font-weight: bold; }
        .stat-value.online { color: #4CAF50; }
        .stat-value.live { color: #f44336; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        
        /* Video */
        .video-container {
            background: #000;
            border-radius: 16px;
            aspect-ratio: 16/9;
            margin-bottom: 20px;
            border: 1px solid #2a2a2a;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #video { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }
        .placeholder { text-align: center; color: #555; }
        .placeholder span { font-size: 48px; }
        .fullscreen-btn {
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0,0,0,0.6);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
        }
        .fullscreen-btn:hover { background: #667eea; }
        
        /* Controls */
        .controls { background: #1a1a1a; border-radius: 16px; padding: 16px; margin-bottom: 20px; border: 1px solid #2a2a2a; }
        .section-title { font-size: 11px; color: #888; margin-bottom: 12px; letter-spacing: 1px; }
        .btn-group { display: flex; gap: 12px; margin-bottom: 20px; }
        .btn { flex: 1; padding: 12px; border: none; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .btn-start { background: #4CAF50; color: white; }
        .btn-stop { background: #f44336; color: white; }
        .btn-flip { background: #2196F3; color: white; }
        .btn:hover { transform: translateY(-2px); opacity: 0.9; }
        
        /* Quality */
        .quality-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
        .quality-btn { padding: 10px; border: 1px solid #2a2a2a; background: #0a0a0a; color: #fff; border-radius: 10px; cursor: pointer; font-size: 12px; text-align: center; }
        .quality-btn.active { background: #667eea; border-color: #667eea; }
        
        /* FPS */
        .fps-slider { width: 100%; margin: 10px 0; }
        .fps-value { text-align: center; font-size: 12px; color: #888; }
        
        /* Devices */
        .devices { background: #1a1a1a; border-radius: 16px; padding: 16px; border: 1px solid #2a2a2a; }
        .device-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #2a2a2a;
        }
        .device-name { font-size: 14px; font-weight: 500; }
        .device-status { width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; }
        .empty { text-align: center; color: #555; padding: 20px; }
        
        @media (max-width: 480px) {
            .quality-grid { gap: 6px; }
            .quality-btn { padding: 8px; font-size: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📹 Ludoo Remote</h1>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-label">STATUS</div>
                <div class="stat-value" id="statusText">● Online</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">DEVICES</div>
                <div class="stat-value" id="deviceCount">0</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">FPS</div>
                <div class="stat-value" id="fpsText">0</div>
            </div>
        </div>
        
        <div class="video-container" id="videoContainer">
            <img id="video" style="display: none;">
            <div id="placeholder" class="placeholder">
                <span>📷</span><br>
                No stream
            </div>
            <button class="fullscreen-btn" id="fullscreenBtn">⛶</button>
        </div>
        
        <div class="controls">
            <div class="section-title">🎮 CONTROLS</div>
            <div class="btn-group">
                <button class="btn btn-start" id="startBtn">▶ START</button>
                <button class="btn btn-stop" id="stopBtn">⏹ STOP</button>
                <button class="btn btn-flip" id="flipBtn">🔄 FLIP</button>
            </div>
            
            <div class="section-title">📐 QUALITY</div>
            <div class="quality-grid">
                <button class="quality-btn" data-quality="120">120p</button>
                <button class="quality-btn" data-quality="140">140p</button>
                <button class="quality-btn active" data-quality="240">240p</button>
                <button class="quality-btn" data-quality="360">360p</button>
            </div>
            
            <div class="section-title">⚡ FPS</div>
            <input type="range" id="fpsSlider" min="5" max="30" value="15" step="1" class="fps-slider">
            <div class="fps-value" id="fpsLabel">15 FPS</div>
        </div>
        
        <div class="devices">
            <div class="section-title">📱 CONNECTED DEVICES</div>
            <div id="devicesList">
                <div class="empty">No devices connected</div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
    <script>
        const socket = io();
        let frameCount = 0, lastFpsUpdate = Date.now(), isStreaming = false;
        
        const video = document.getElementById('video');
        const placeholder = document.getElementById('placeholder');
        const videoContainer = document.getElementById('videoContainer');
        const deviceCountSpan = document.getElementById('deviceCount');
        const fpsText = document.getElementById('fpsText');
        const devicesList = document.getElementById('devicesList');
        const statusText = document.getElementById('statusText');
        
        // Fullscreen
        document.getElementById('fullscreenBtn').onclick = () => {
            if (!document.fullscreenElement) videoContainer.requestFullscreen();
            else document.exitFullscreen();
        };
        
        // Socket events
        socket.on('connect', () => console.log('Connected'));
        
        socket.on('frame', (data) => {
            if (data && data.image && isStreaming) {
                video.src = 'data:image/jpeg;base64,' + data.image;
                video.style.display = 'block';
                placeholder.style.display = 'none';
                frameCount++;
                const now = Date.now();
                if (now - lastFpsUpdate >= 1000) {
                    fpsText.textContent = frameCount;
                    frameCount = 0;
                    lastFpsUpdate = now;
                }
            }
        });
        
        socket.on('devices_list', (devices) => {
            deviceCountSpan.textContent = devices.length;
            if (devices.length === 0) {
                devicesList.innerHTML = '<div class="empty">No devices connected</div>';
            } else {
                devicesList.innerHTML = devices.map(d => 
                    '<div class="device-item"><span class="device-name">📱 ' + d.name + '</span><div class="device-status"></div></div>'
                ).join('');
            }
        });
        
        socket.on('status', (status) => {
            isStreaming = status.streaming;
            if (status.streaming) {
                statusText.innerHTML = '● LIVE';
                statusText.className = 'stat-value live';
            } else {
                statusText.innerHTML = '● Online';
                statusText.className = 'stat-value online';
            }
        });
        
        function sendCommand(command, value) {
            socket.emit('command', { command, value });
        }
        
        document.getElementById('startBtn').onclick = () => sendCommand('start');
        document.getElementById('stopBtn').onclick = () => sendCommand('stop');
        document.getElementById('flipBtn').onclick = () => sendCommand('flip');
        
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sendCommand('quality', parseInt(btn.dataset.quality));
            };
        });
        
        const fpsSlider = document.getElementById('fpsSlider');
        const fpsLabel = document.getElementById('fpsLabel');
        fpsSlider.oninput = () => {
            fpsLabel.textContent = fpsSlider.value + ' FPS';
            sendCommand('fps', parseInt(fpsSlider.value));
        };
    </script>
</body>
</html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', devices: devices.length });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ Ludoo Remote Server Started');
  console.log('═══════════════════════════════════════');
  console.log(`🌐 http://localhost:${PORT}`);
  console.log('═══════════════════════════════════════');
  console.log('📡 Waiting for device...');
});
