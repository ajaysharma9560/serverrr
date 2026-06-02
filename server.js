const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

let devices = {};

// Auto offline check
setInterval(() => {
  const now = Date.now();
  let changed = false;

  Object.keys(devices).forEach(id => {
    if (now - devices[id].lastSeen > 12000) {
      if (devices[id].status !== "offline") {
        devices[id].status = "offline";
        devices[id].streaming = false;
        changed = true;
        console.log(`📴 ${devices[id].name} went offline`);
      }
    }
  });

  if (changed) {
    io.emit("devices", devices);
  }
}, 4000);

io.on("connection", (socket) => {
  console.log("🔌 New connection:", socket.id);

  // Device registers
  socket.on("register_device", (data) => {
    console.log("📱 Device registered:", data.name);
    
    devices[socket.id] = {
      id: socket.id,
      name: data.name,
      status: "online",
      streaming: false,
      lastSeen: Date.now()
    };

    io.emit("devices", devices);
    socket.emit("registered", { status: "ok" });
  });

  // Heartbeat
  socket.on("heartbeat", () => {
    if (devices[socket.id]) {
      devices[socket.id].lastSeen = Date.now();
      if (devices[socket.id].status !== "online") {
        devices[socket.id].status = "online";
        io.emit("devices", devices);
      }
    }
  });

  // Streaming status
  socket.on("streaming_status", (status) => {
    if (devices[socket.id]) {
      devices[socket.id].streaming = status;
      io.emit("devices", devices);
    }
  });

  // Frames
  socket.on("frame", (data) => {
    socket.broadcast.emit("frame", data);
  });

  // ⭐ COMMAND from dashboard to device
  socket.on("command", (cmd) => {
    console.log("🎮 Command:", cmd);
    
    // Find first online device
    let targetId = null;
    for (let id in devices) {
      if (devices[id].status === "online") {
        targetId = id;
        break;
      }
    }
    
    if (targetId) {
      console.log(`📤 Sending to: ${devices[targetId].name}`);
      io.to(targetId).emit("command", cmd);
      socket.emit("command_status", { success: true, message: "Command sent" });
    } else {
      console.log("❌ No online device");
      socket.emit("command_status", { success: false, message: "No device online" });
    }
  });

  socket.on("disconnect", () => {
    if (devices[socket.id]) {
      console.log("🔌 Device disconnected:", devices[socket.id].name);
      delete devices[socket.id];
      io.emit("devices", devices);
    }
  });
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Camera Controller</title>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    font-family: -apple-system, 'Segoe UI', sans-serif;
    min-height: 100vh;
    padding: 20px;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
}

.header {
    text-align: center;
    margin-bottom: 25px;
}

.header h1 {
    font-size: 28px;
    background: linear-gradient(135deg, #fff, #a0c0ff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.header p {
    color: rgba(255,255,255,0.6);
    font-size: 14px;
    margin-top: 5px;
}

.grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
}

.card {
    background: rgba(15, 25, 35, 0.7);
    backdrop-filter: blur(12px);
    border-radius: 24px;
    border: 1px solid rgba(255,255,255,0.18);
    padding: 20px;
}

.video-container {
    background: #000;
    border-radius: 16px;
    overflow: hidden;
    aspect-ratio: 16/9;
    margin-bottom: 20px;
    position: relative;
}

.video-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.no-stream {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: rgba(255,255,255,0.5);
}

.stats {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
}

.stat {
    flex: 1;
    background: rgba(0,0,0,0.4);
    border-radius: 12px;
    padding: 10px;
    text-align: center;
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #00ff88;
}

.stat-label {
    font-size: 10px;
    color: rgba(255,255,255,0.6);
}

.buttons {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
}

.btn {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 40px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
}

.btn-start { background: #00b894; color: white; }
.btn-stop { background: #d63031; color: white; }
.btn-flip { background: #0984e3; color: white; }

.quality-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.q-btn {
    flex: 1;
    padding: 8px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 40px;
    color: white;
    font-size: 12px;
    cursor: pointer;
    text-align: center;
}

.q-btn.active {
    background: #00ff88;
    color: #1a1a2e;
}

.device-card {
    background: rgba(0,0,0,0.3);
    border-radius: 16px;
    padding: 15px;
    margin-bottom: 15px;
}

.device-name {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 8px;
}

.device-status {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    margin-bottom: 8px;
}

.online { background: rgba(0,255,136,0.2); color: #00ff88; }
.offline { background: rgba(255,0,0,0.2); color: #ff6b6b; }

.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #1f2937;
    padding: 10px 20px;
    border-radius: 30px;
    font-size: 14px;
    z-index: 1000;
    animation: slideUp 0.3s ease;
}

@keyframes slideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (max-width: 768px) {
    .grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>📷 Camera Controller</h1>
        <p>Live stream from your device</p>
    </div>
    
    <div class="grid">
        <div class="card">
            <div class="video-container">
                <img id="video" src="">
                <div id="noStream" class="no-stream">
                    <span>📹</span>
                    <p>No active stream</p>
                </div>
            </div>
            
            <div class="stats">
                <div class="stat"><div class="stat-value" id="fps">0</div><div class="stat-label">FPS</div></div>
                <div class="stat"><div class="stat-value" id="resolution">-</div><div class="stat-label">Resolution</div></div>
                <div class="stat"><div class="stat-value" id="quality">-</div><div class="stat-label">Quality</div></div>
            </div>
            
            <div class="buttons">
                <button class="btn btn-start" onclick="sendCmd('start')">▶ START</button>
                <button class="btn btn-stop" onclick="sendCmd('stop')">⏹ STOP</button>
                <button class="btn btn-flip" onclick="sendCmd('flip')">🔄 FLIP</button>
            </div>
            
            <div class="quality-buttons">
                <button class="q-btn" onclick="sendQuality('120p')">120p</button>
                <button class="q-btn" onclick="sendQuality('140p')">140p</button>
                <button class="q-btn" onclick="sendQuality('240p')">240p</button>
                <button class="q-btn" onclick="sendQuality('360p')">360p</button>
                <button class="q-btn" onclick="sendQuality('480p')">480p</button>
            </div>
        </div>
        
        <div class="card">
            <h3 style="margin-bottom: 15px;">📱 Device Status</h3>
            <div id="deviceList"></div>
        </div>
    </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
let frameCount = 0;
let lastTime = Date.now();

socket.on('connect', () => showToast('✅ Connected', '#00ff88'));
socket.on('disconnect', () => showToast('❌ Disconnected', '#ff6b6b'));

socket.on('frame', (data) => {
    document.getElementById('video').src = data;
    document.getElementById('noStream').style.display = 'none';
    frameCount++;
    
    const now = Date.now();
    if (now - lastTime >= 1000) {
        document.getElementById('fps').innerText = frameCount;
        frameCount = 0;
        lastTime = now;
    }
});

socket.on('devices', (devices) => {
    const container = document.getElementById('deviceList');
    if (Object.keys(devices).length === 0) {
        container.innerHTML = '<div class="device-card"><div class="device-name">No device connected</div><div class="device-status offline">Offline</div></div>';
        return;
    }
    
    let html = '';
    for (let id in devices) {
        const d = devices[id];
        html += \`
            <div class="device-card">
                <div class="device-name">📱 \${d.name}</div>
                <div class="device-status \${d.status}">\${d.status.toUpperCase()}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.5);">🎥 Streaming: \${d.streaming ? 'Yes' : 'No'}</div>
            </div>
        \`;
    }
    container.innerHTML = html;
});

socket.on('command_status', (data) => {
    if (data.success) {
        showToast('✅ ' + data.message, '#00ff88');
    } else {
        showToast('❌ ' + data.message, '#ff6b6b');
    }
});

function sendCmd(cmd) {
    console.log('Sending:', cmd);
    socket.emit('command', cmd);
    showToast('📨 Sending: ' + cmd, '#0984e3');
}

function sendQuality(q) {
    socket.emit('command', { type: 'quality', value: q });
    document.getElementById('quality').innerText = q;
    showToast('📊 Quality: ' + q, '#00ff88');
}

function showToast(msg, color) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = color;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

document.getElementById('resolution').innerText = '640x480';
document.getElementById('quality').innerText = '360p';
</script>
</body>
</html>
  `);
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════╗
║  🚀 Server running         ║
║  📡 Port: ${PORT}            ║
║  🌐 http://localhost:${PORT} ║
╚════════════════════════════╝
  `);
});
