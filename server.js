const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Store state
let connectedDevices = [];
let activeStream = false;
let currentQuality = 240;
let currentFps = 15;
let selectedDeviceId = null;

io.on('connection', (socket) => {
  console.log('📱 New connection:', socket.id);
  
  // ========== ANDROID DEVICE EVENTS ==========
  
  socket.on('register_device', (data) => {
    const device = {
      id: socket.id,
      name: data.deviceName || "Android Device",
      model: data.model || "Unknown",
      camera: data.camera || "back",
      status: 'online',
      connectedAt: new Date().toLocaleTimeString()
    };
    
    const existingIndex = connectedDevices.findIndex(d => d.id === socket.id);
    if (existingIndex >= 0) {
      connectedDevices[existingIndex] = device;
    } else {
      connectedDevices.push(device);
    }
    
    if (!selectedDeviceId) {
      selectedDeviceId = socket.id;
    }
    
    console.log(`✅ Device registered: ${device.name}`);
    console.log(`📊 Total devices: ${connectedDevices.length}`);
    
    io.emit('devices_list', connectedDevices);
    io.emit('selected_device', selectedDeviceId);
    
    socket.emit('settings', {
      quality: currentQuality,
      fps: currentFps,
      stream: activeStream
    });
    
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
  });
  
  socket.on('stream_frame', (data) => {
    if (data && data.image && activeStream && selectedDeviceId === socket.id) {
      io.emit('frame', {
        image: data.image,
        timestamp: Date.now(),
        quality: data.quality || currentQuality,
        fps: data.fps || currentFps
      });
    }
  });
  
  socket.on('select_device', (data) => {
    const deviceId = data.deviceId;
    const device = connectedDevices.find(d => d.id === deviceId);
    if (device) {
      selectedDeviceId = deviceId;
      console.log(`🖱️ Selected device: ${device.name}`);
      io.emit('selected_device', selectedDeviceId);
      io.emit('status_update', {
        devices: connectedDevices.length,
        stream: activeStream,
        quality: currentQuality,
        fps: currentFps,
        selectedDevice: selectedDeviceId
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Device disconnected:', socket.id);
    connectedDevices = connectedDevices.filter(d => d.id !== socket.id);
    
    if (selectedDeviceId === socket.id && connectedDevices.length > 0) {
      selectedDeviceId = connectedDevices[0].id;
      io.emit('selected_device', selectedDeviceId);
    } else if (connectedDevices.length === 0) {
      selectedDeviceId = null;
    }
    
    io.emit('devices_list', connectedDevices);
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
    console.log(`📊 Remaining devices: ${connectedDevices.length}`);
  });
  
  // ========== WEB COMMAND HANDLER ==========
  
  socket.on('command', (data) => {
    const { command, value } = data;
    console.log(`🎮 Command: ${command} ${value ? '= ' + value : ''}`);
    
    switch(command) {
      case 'start':
        activeStream = true;
        console.log('▶ Stream STARTED');
        break;
      case 'stop':
        activeStream = false;
        console.log('⏹ Stream STOPPED');
        break;
      case 'flip':
        console.log('🔄 Flip camera');
        break;
      case 'quality':
        currentQuality = value;
        console.log(`🎨 Quality: ${value}p`);
        break;
      case 'fps':
        currentFps = value;
        console.log(`⚡ FPS: ${value}`);
        break;
    }
    
    if (selectedDeviceId) {
      io.to(selectedDeviceId).emit('command', { command, value });
    }
    
    io.emit('status_update', {
      devices: connectedDevices.length,
      stream: activeStream,
      quality: currentQuality,
      fps: currentFps,
      selectedDevice: selectedDeviceId
    });
  });
  
  socket.emit('devices_list', connectedDevices);
  socket.emit('selected_device', selectedDeviceId);
  socket.emit('status_update', {
    devices: connectedDevices.length,
    stream: activeStream,
    quality: currentQuality,
    fps: currentFps,
    selectedDevice: selectedDeviceId
  });
});

// ========== WEB INTERFACE ==========

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Ludoo Camera Remote</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #0a0a0a;
                min-height: 100vh;
                padding: 20px;
                color: #fff;
            }
            .container { max-width: 600px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { font-size: 24px; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .header p { font-size: 12px; color: #666; margin-top: 5px; }
            #selectedLabel { font-size: 11px; color: #4CAF50; margin-top: 5px; }
            
            .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .stat-card { background: #1a1a1a; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #2a2a2a; }
            .stat-label { font-size: 11px; color: #888; margin-bottom: 5px; }
            .stat-value { font-size: 20px; font-weight: 700; }
            .stat-value.online { color: #4CAF50; }
            .stat-value.streaming { color: #f44336; animation: pulse 1s infinite; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
            
            .video-container { 
                background: #000; 
                border-radius: 16px; 
                overflow: hidden; 
                aspect-ratio: 16 / 9; 
                margin-bottom: 20px; 
                border: 1px solid #2a2a2a; 
                display: flex; 
                align-items: center; 
                justify-content: center;
                position: relative;
            }
            #video { width: 100%; height: 100%; object-fit: cover; }
            .video-placeholder { text-align: center; color: #555; }
            .video-placeholder span { font-size: 48px; }
            
            /* ✅ Fullscreen Button */
            .fullscreen-btn {
                position: absolute;
                bottom: 10px;
                right: 10px;
                background: rgba(0,0,0,0.6);
                border: none;
                color: white;
                font-size: 20px;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                transition: all 0.3s;
            }
            .fullscreen-btn:hover { background: #667eea; }
            
            .video-container.fullscreen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                margin: 0;
                border-radius: 0;
                aspect-ratio: auto;
            }
            .video-container.fullscreen .fullscreen-btn {
                bottom: 20px;
                right: 20px;
            }
            
            .controls { background: #1a1a1a; border-radius: 16px; padding: 16px; margin-bottom: 20px; border: 1px solid #2a2a2a; }
            .section-title { font-size: 12px; color: #888; margin-bottom: 12px; letter-spacing: 1px; }
            .button-group { display: flex; gap: 12px; margin-bottom: 20px; }
            .btn { flex: 1; padding: 12px; border: none; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
            .btn-start { background: #4CAF50; color: white; }
            .btn-start:hover { background: #45a049; }
            .btn-stop { background: #f44336; color: white; }
            .btn-stop:hover { background: #da190b; }
            .btn-flip { background: #2196F3; color: white; }
            .btn-flip:hover { background: #0b7dda; }
            
            .quality-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
            .quality-btn { padding: 10px; border: 1px solid #2a2a2a; background: #0a0a0a; color: #fff; border-radius: 10px; cursor: pointer; font-size: 12px; text-align: center; }
            .quality-btn.active { background: #667eea; border-color: #667eea; }
            
            .fps-control { margin-top: 16px; }
            .fps-slider { width: 100%; height: 4px; -webkit-appearance: none; background: #2a2a2a; border-radius: 2px; margin: 10px 0; }
            .fps-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; background: #667eea; border-radius: 50%; cursor: pointer; }
            .fps-value { text-align: center; font-size: 12px; color: #888; }
            
            /* ✅ Clickable Device Panel */
            .devices { background: #1a1a1a; border-radius: 16px; padding: 16px; border: 1px solid #2a2a2a; }
            .device-item { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                padding: 12px 0; 
                border-bottom: 1px solid #2a2a2a;
                cursor: pointer;
                transition: all 0.2s;
            }
            .device-item:hover { 
                background: #252525; 
                padding-left: 8px; 
                border-radius: 8px; 
            }
            .device-item.active { 
                background: linear-gradient(135deg, #667eea20, #764ba220); 
                border-left: 3px solid #667eea; 
                padding-left: 8px; 
                border-radius: 8px; 
            }
            .device-item:last-child { border-bottom: none; }
            .device-name { font-size: 14px; font-weight: 500; }
            .device-status { width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; }
            .device-badge {
                font-size: 10px;
                background: #667eea;
                padding: 2px 8px;
                border-radius: 12px;
                margin-left: 8px;
            }
            .empty-devices { text-align: center; color: #555; padding: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📹 Ludoo Remote</h1>
                <p>15 FPS | Low Data Streaming</p>
                <div id="selectedLabel">Select a device to view</div>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-label">STATUS</div>
                    <div class="stat-value" id="serverStatus">● Online</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">DEVICES</div>
                    <div class="stat-value" id="deviceCount">0</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">FPS</div>
                    <div class="stat-value" id="fpsCount">0</div>
                </div>
            </div>
            
            <div class="video-container" id="videoContainer">
                <img id="video" style="display: none;">
                <div id="placeholder" class="video-placeholder">
                    <span>📷</span><br>
                    No stream
                </div>
                <button class="fullscreen-btn" id="fullscreenBtn">⛶</button>
            </div>
            
            <div class="controls">
                <div class="section-title">🎮 CONTROLS</div>
                <div class="button-group">
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
                
                <div class="fps-control">
                    <div class="section-title">⚡ FPS</div>
                    <input type="range" id="fpsSlider" min="5" max="30" value="15" step="1" class="fps-slider">
                    <div class="fps-value" id="fpsLabel">15 FPS (Recommended)</div>
                </div>
            </div>
            
            <div class="devices">
                <div class="section-title">📱 CONNECTED DEVICES (Click to select)</div>
                <div id="devicesList">
                    <div class="empty-devices">No devices connected</div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <script>
            const socket = io();
            let frameCount = 0;
            let lastFpsUpdate = Date.now();
            let isStreaming = false;
            let selectedDeviceId = null;
            let devicesData = [];
            
            const video = document.getElementById('video');
            const placeholder = document.getElementById('placeholder');
            const deviceCountSpan = document.getElementById('deviceCount');
            const fpsCountSpan = document.getElementById('fpsCount');
            const devicesList = document.getElementById('devicesList');
            const fpsSlider = document.getElementById('fpsSlider');
            const fpsLabel = document.getElementById('fpsLabel');
            const selectedLabel = document.getElementById('selectedLabel');
            const videoContainer = document.getElementById('videoContainer');
            const fullscreenBtn = document.getElementById('fullscreenBtn');
            
            // ✅ Fullscreen
            fullscreenBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    videoContainer.requestFullscreen().catch(err => console.log(err));
                } else {
                    document.exitFullscreen();
                }
            });
            
            document.addEventListener('fullscreenchange', () => {
                if (document.fullscreenElement) {
                    videoContainer.classList.add('fullscreen');
                } else {
                    videoContainer.classList.remove('fullscreen');
                }
            });
            
            socket.on('connect', () => {
                console.log('Connected to server');
            });
            
            socket.on('frame', (data) => {
                if (data && data.image && isStreaming) {
                    video.src = 'data:image/jpeg;base64,' + data.image;
                    video.style.display = 'block';
                    placeholder.style.display = 'none';
                    
                    frameCount++;
                    const now = Date.now();
                    if (now - lastFpsUpdate >= 1000) {
                        fpsCountSpan.textContent = frameCount;
                        frameCount = 0;
                        lastFpsUpdate = now;
                    }
                }
            });
            
            socket.on('devices_list', (devices) => {
                devicesData = devices;
                deviceCountSpan.textContent = devices.length;
                
                if (devices.length === 0) {
                    devicesList.innerHTML = '<div class="empty-devices">No devices connected</div>';
                    video.style.display = 'none';
                    placeholder.style.display = 'block';
                    isStreaming = false;
                    selectedLabel.innerHTML = 'Select a device to view';
                } else {
                    devicesList.innerHTML = devices.map(device => 
                        '<div class="device-item ' + (selectedDeviceId === device.id ? 'active' : '') + '" onclick="selectDevice(\'' + device.id + '\')">' +
                            '<span class="device-name">📱 ' + device.name + '</span>' +
                            '<div style="display: flex; align-items: center; gap: 8px;">' +
                                '<div class="device-status"></div>' +
                                (selectedDeviceId === device.id ? '<span class="device-badge">VIEWING</span>' : '') +
                            '</div>' +
                        '</div>'
                    ).join('');
                }
            });
            
            socket.on('selected_device', (deviceId) => {
                selectedDeviceId = deviceId;
                const device = devicesData.find(d => d.id === deviceId);
                if (device) {
                    selectedLabel.innerHTML = 'Viewing: ' + device.name;
                }
                
                document.querySelectorAll('.device-item').forEach(el => {
                    el.classList.remove('active');
                });
                const activeEl = document.querySelector('.device-item[onclick="selectDevice(\'' + deviceId + '\')"]');
                if (activeEl) activeEl.classList.add('active');
            });
            
            socket.on('status_update', (status) => {
                isStreaming = status.stream;
                const serverStatus = document.getElementById('serverStatus');
                if (status.stream) {
                    serverStatus.innerHTML = '● LIVE';
                    serverStatus.style.color = '#f44336';
                } else {
                    serverStatus.innerHTML = '● Online';
                    serverStatus.style.color = '#4CAF50';
                }
            });
            
            window.selectDevice = function(deviceId) {
                console.log('Selecting device:', deviceId);
                socket.emit('select_device', { deviceId: deviceId });
                isStreaming = false;
                video.style.display = 'none';
                placeholder.style.display = 'block';
                fpsCountSpan.textContent = '0';
            };
            
            function sendCommand(command, value = null) {
                if (!selectedDeviceId) {
                    console.log('No device selected');
                    selectedLabel.innerHTML = '⚠️ Click on a device first!';
                    setTimeout(() => {
                        const device = devicesData.find(d => d.id === selectedDeviceId);
                        if (device) selectedLabel.innerHTML = 'Viewing: ' + device.name;
                        else selectedLabel.innerHTML = 'Select a device to view';
                    }, 2000);
                    return;
                }
                socket.emit('command', { command, value });
                console.log('Command:', command, value);
            }
            
            document.getElementById('startBtn').onclick = () => {
                sendCommand('start');
                isStreaming = true;
            };
            document.getElementById('stopBtn').onclick = () => {
                sendCommand('stop');
                isStreaming = false;
                video.style.display = 'none';
                placeholder.style.display = 'block';
                fpsCountSpan.textContent = '0';
            };
            document.getElementById('flipBtn').onclick = () => sendCommand('flip');
            
            document.querySelectorAll('.quality-btn').forEach(btn => {
                btn.onclick = () => {
                    document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const quality = parseInt(btn.dataset.quality);
                    sendCommand('quality', quality);
                };
            });
            
            fpsSlider.oninput = () => {
                const fps = parseInt(fpsSlider.value);
                fpsLabel.textContent = fps + ' FPS';
                sendCommand('fps', fps);
            };
        </script>
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    devices: connectedDevices.length,
    streamActive: activeStream,
    quality: currentQuality,
    fps: currentFps,
    selectedDevice: selectedDeviceId,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Ludoo Camera Remote Server Started');
  console.log('═══════════════════════════════════════════════════');
  console.log(`🌐 Web Interface: http://localhost:${PORT}`);
  console.log(`💪 Health Check: http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('📱 Features:');
  console.log('   • Fullscreen button on video');
  console.log('   • Clickable device panel');
  console.log('   • Multi-device support');
  console.log('   • START/STOP/FLIP controls');
  console.log('   • 4 Quality options');
  console.log('   • FPS Control');
  console.log('');
  console.log('📡 Waiting for Android device...');
  console.log('');
});
