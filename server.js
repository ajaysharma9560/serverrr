const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { 
  cors: { origin: "*" },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

let devices = new Map();
let selectedDeviceId = null;

// Quality presets with resolution
const qualityPresets = {
  '140p': { width: 160, height: 140, quality: 15 },
  '240p': { width: 320, height: 240, quality: 25 },
  '360p': { width: 480, height: 360, quality: 35 },
  '480p': { width: 640, height: 480, quality: 50 }
};

// Main Page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Multi Device Live Stream</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: linear-gradient(135deg, #000000, #1a1a2e); font-family: system-ui; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            
            h1 { color: white; text-align: center; margin-bottom: 20px; font-size: 24px; }
            h2 { color: white; font-size: 18px; margin-bottom: 10px; }
            
            /* Device List */
            .device-section {
                background: rgba(0,0,0,0.5);
                border-radius: 20px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .device-title { color: white; margin-bottom: 10px; font-size: 16px; }
            .device-list {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
            }
            .device-card {
                background: rgba(255,255,255,0.1);
                border-radius: 12px;
                padding: 10px 15px;
                cursor: pointer;
                border: 1px solid rgba(255,255,255,0.1);
                min-width: 120px;
            }
            .device-card.selected {
                border: 2px solid #22c55e;
                background: rgba(34,197,94,0.2);
            }
            .device-name { color: white; font-weight: bold; font-size: 14px; }
            .device-status { font-size: 11px; margin-top: 4px; }
            .status-online { color: #22c55e; }
            
            /* Stream Section */
            .stream-section {
                background: rgba(0,0,0,0.7);
                border-radius: 20px;
                padding: 20px;
                backdrop-filter: blur(10px);
                margin-bottom: 20px;
                cursor: pointer;
            }
            .video-container {
                background: #000;
                border-radius: 16px;
                overflow: hidden;
                aspect-ratio: 16/9;
                border: 2px solid #333;
                margin-bottom: 15px;
            }
            #streamImage {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .stream-info {
                display: flex;
                justify-content: space-between;
                color: white;
                margin-bottom: 15px;
            }
            .fps { color: #22c55e; font-family: monospace; }
            .click-hint {
                text-align: center;
                color: #888;
                font-size: 12px;
                margin-top: 5px;
            }
            
            /* Quality Section */
            .quality-section {
                background: rgba(0,0,0,0.5);
                border-radius: 20px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .quality-title { color: white; margin-bottom: 10px; }
            .quality-buttons {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            .quality-btn {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                padding: 8px 16px;
                border-radius: 8px;
                color: white;
                cursor: pointer;
                transition: 0.2s;
            }
            .quality-btn:hover { background: rgba(255,255,255,0.2); }
            .quality-btn.active {
                background: #22c55e;
                border-color: #22c55e;
            }
            
            /* Control Section */
            .control-section {
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-bottom: 20px;
                flex-wrap: wrap;
            }
            button {
                padding: 12px 24px;
                font-size: 16px;
                font-weight: bold;
                border: none;
                border-radius: 40px;
                cursor: pointer;
                transition: transform 0.2s;
            }
            button:active { transform: scale(0.96); }
            .btn-start { background: #22c55e; color: white; }
            .btn-stop { background: #ef4444; color: white; }
            .btn-flip { background: #3b82f6; color: white; }
            
            /* Fullscreen Modal */
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.95);
                backdrop-filter: blur(5px);
                justify-content: center;
                align-items: center;
                flex-direction: column;
            }
            .modal.active { display: flex; }
            .modal img {
                max-width: 95%;
                max-height: 85%;
                object-fit: contain;
                border-radius: 12px;
            }
            .modal-close {
                position: absolute;
                top: 20px;
                right: 30px;
                font-size: 40px;
                color: white;
                cursor: pointer;
                background: rgba(0,0,0,0.5);
                width: 50px;
                height: 50px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .modal-close:hover { background: rgba(255,255,255,0.2); }
            .modal-info {
                color: white;
                margin-top: 20px;
                font-size: 14px;
                text-align: center;
            }
            
            .footer { text-align: center; color: #555; font-size: 11px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📹 Multi Device Live Stream</h1>
            
            <!-- Device List -->
            <div class="device-section">
                <div class="device-title">📱 Connected Devices</div>
                <div class="device-list" id="deviceList">
                    <div style="color:#888;">Waiting for devices...</div>
                </div>
            </div>
            
            <!-- Stream Section -->
            <div class="stream-section" id="streamSection">
                <div class="video-container">
                    <img id="streamImage" src="">
                </div>
                <div class="stream-info">
                    <span>📡 Device: <span id="selectedDevice">None</span></span>
                    <span class="fps">⚡ <span id="fpsValue">0</span> FPS</span>
                </div>
                <div class="click-hint">✨ Click on stream for fullscreen ✨</div>
            </div>
            
            <!-- Quality Section -->
            <div class="quality-section">
                <div class="quality-title">🎯 Stream Quality</div>
                <div class="quality-buttons" id="qualityButtons">
                    <button class="quality-btn" data-quality="140p">140p (Lowest)</button>
                    <button class="quality-btn active" data-quality="240p">240p</button>
                    <button class="quality-btn" data-quality="360p">360p</button>
                    <button class="quality-btn" data-quality="480p">480p (Highest)</button>
                </div>
            </div>
            
            <!-- Control Section -->
            <div class="control-section">
                <button class="btn-start" id="startBtn">▶ START</button>
                <button class="btn-stop" id="stopBtn">⏹ STOP</button>
                <button class="btn-flip" id="flipBtn">🔄 Flip Camera</button>
            </div>
            
            <div class="footer">🔒 Secure | 🎯 140p/240p/360p/480p | 🔄 Flip Camera | ✨ Click stream for fullscreen</div>
        </div>
        
        <!-- Fullscreen Modal -->
        <div class="modal" id="fullscreenModal">
            <div class="modal-close" id="modalClose">✕</div>
            <img id="modalImage" src="">
            <div class="modal-info" id="modalInfo">Live Stream | Click anywhere to close</div>
        </div>
        
        <script>
            const socket = io();
            let selectedDeviceId = null;
            let currentQuality = '240p';
            let fps = 0, lastFpsUpdate = Date.now();
            
            const streamImage = document.getElementById('streamImage');
            const modalImage = document.getElementById('modalImage');
            const fpsSpan = document.getElementById('fpsValue');
            const selectedDeviceSpan = document.getElementById('selectedDevice');
            const deviceListDiv = document.getElementById('deviceList');
            const streamSection = document.getElementById('streamSection');
            const modal = document.getElementById('fullscreenModal');
            const modalClose = document.getElementById('modalClose');
            const modalInfo = document.getElementById('modalInfo');
            
            function updateFPS() {
                const now = Date.now();
                if (now - lastFpsUpdate >= 1000) {
                    fpsSpan.innerText = fps;
                    fps = 0;
                    lastFpsUpdate = now;
                }
                requestAnimationFrame(updateFPS);
            }
            updateFPS();
            
            function selectDevice(deviceId, deviceName) {
                selectedDeviceId = deviceId;
                selectedDeviceSpan.innerText = deviceName || deviceId.substring(0, 15);
                document.querySelectorAll('.device-card').forEach(card => {
                    card.classList.remove('selected');
                    if(card.dataset.id === deviceId) card.classList.add('selected');
                });
            }
            
            function setQuality(quality) {
                currentQuality = quality;
                document.querySelectorAll('.quality-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if(btn.dataset.quality === quality) btn.classList.add('active');
                });
                if(selectedDeviceId) {
                    socket.emit('set-quality', { deviceId: selectedDeviceId, quality: quality });
                }
            }
            
            function openFullscreen() {
                if (streamImage.src && streamImage.src !== window.location.href) {
                    modalImage.src = streamImage.src;
                    modalInfo.innerHTML = \`📡 \${selectedDeviceSpan.innerText} | ⚡ \${fpsSpan.innerText} FPS | \${currentQuality}\`;
                    modal.classList.add('active');
                }
            }
            
            function closeFullscreen() { modal.classList.remove('active'); }
            
            streamSection.onclick = openFullscreen;
            modal.onclick = closeFullscreen;
            modalClose.onclick = closeFullscreen;
            
            socket.on('device-list', (devices) => {
                const deviceList = Object.values(devices);
                if(deviceList.length === 0) {
                    deviceListDiv.innerHTML = '<div style="color:#888;">No devices connected...</div>';
                    return;
                }
                deviceListDiv.innerHTML = deviceList.map(d => \`
                    <div class="device-card" data-id="\${d.id}" onclick="selectDevice('\${d.id}', '\${d.name || d.id.substring(0,10)}')">
                        <div class="device-name">📱 \${d.name || d.id.substring(0,10)}</div>
                        <div class="device-status"><span class="status-online">● Online</span></div>
                    </div>
                \`).join('');
            });
            
            socket.on('frame', (data) => { 
                streamImage.src = data;
                if (modal.classList.contains('active')) modalImage.src = data;
                fps++; 
            });
            
            document.getElementById('startBtn').onclick = () => {
                if(selectedDeviceId) socket.emit('command', { deviceId: selectedDeviceId, command: 'start' });
            };
            document.getElementById('stopBtn').onclick = () => {
                if(selectedDeviceId) socket.emit('command', { deviceId: selectedDeviceId, command: 'stop' });
            };
            document.getElementById('flipBtn').onclick = () => {
                if(selectedDeviceId) socket.emit('flip-camera', { deviceId: selectedDeviceId });
            };
            
            document.querySelectorAll('.quality-btn').forEach(btn => {
                btn.onclick = () => setQuality(btn.dataset.quality);
            });
        </script>
    </body>
    </html>
  `);
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('✅ New connection:', socket.id);
  let currentDeviceId = null;
  
  socket.on('register', (data) => {
    currentDeviceId = data.deviceId;
    devices.set(currentDeviceId, {
      id: currentDeviceId,
      name: data.deviceName,
      status: 'online',
      socketId: socket.id
    });
    console.log('📱 Device registered:', data.deviceName);
    broadcastDeviceList();
  });
  
  socket.on('frame', (data) => {
    io.emit('frame', data);
  });
  
  socket.on('command', (data) => {
    const device = devices.get(data.deviceId);
    if(device && device.socketId) {
      io.to(device.socketId).emit('command', data.command);
      console.log('🎮 Command:', data.command, 'to', device.name);
    }
  });
  
  socket.on('set-quality', (data) => {
    const device = devices.get(data.deviceId);
    if(device && device.socketId) {
      const quality = qualityPresets[data.quality];
      io.to(device.socketId).emit('set-quality', { 
        quality: data.quality, 
        width: quality.width, 
        height: quality.height,
        value: quality.quality
      });
      console.log('🎯 Quality:', data.quality, 'to', device.name);
    }
  });
  
  socket.on('flip-camera', (data) => {
    const device = devices.get(data.deviceId);
    if(device && device.socketId) {
      io.to(device.socketId).emit('flip-camera');
      console.log('🔄 Flip camera:', device.name);
    }
  });
  
  socket.on('heartbeat', (deviceId) => {
    const device = devices.get(deviceId);
    if(device) {
      device.status = 'online';
      devices.set(deviceId, device);
    }
  });
  
  socket.on('disconnect', () => {
    if(currentDeviceId) {
      devices.delete(currentDeviceId);
      console.log('❌ Device disconnected:', currentDeviceId);
      broadcastDeviceList();
    }
  });
});

function broadcastDeviceList() {
  const list = {};
  for(let [id, device] of devices) {
    list[id] = { id: device.id, name: device.name, status: device.status };
  }
  io.emit('device-list', list);
}

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ MULTI DEVICE STREAM SERVER');
  console.log('═══════════════════════════════════════');
  console.log('📍 Quality: 140p | 240p | 360p | 480p');
  console.log('📍 Flip Camera: Available');
  console.log('📍 Fullscreen: Click on stream');
  console.log('📍 Multi Device: Yes');
  console.log('═══════════════════════════════════════');
});
