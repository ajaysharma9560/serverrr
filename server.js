const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Storage
let phones = [];
let isLive = false;
let videoQuality = 240;
let videoSpeed = 15;

io.on('connection', (socket) => {
  console.log(`⚡ ${socket.id} connected`);

  // Phone registers
  socket.on('phone_join', (info) => {
    const newPhone = {
      sid: socket.id,
      title: info.name || 'My Phone',
      brand: info.model || 'Android',
      active: true,
      joined: new Date().toLocaleTimeString()
    };
    
    const found = phones.find(p => p.sid === socket.id);
    if (!found) phones.push(newPhone);
    else found.active = true;
    
    console.log(`📱 ${newPhone.title} joined`);
    console.log(`📊 Total: ${phones.length}`);
    
    io.emit('phone_list', phones);
    io.emit('live_status', { streaming: isLive, count: phones.length, quality: videoQuality, fps: videoSpeed });
  });

  // Video stream from phone
  socket.on('video_chunk', (chunk) => {
    if (isLive && chunk.picture) {
      socket.broadcast.emit('video_feed', {
        img: chunk.picture,
        time: Date.now()
      });
    }
  });

  // Commands from web
  socket.on('remote_action', (action) => {
    console.log(`🎛️ ${action.type} ${action.value || ''}`);
    
    if (action.type === 'play') isLive = true;
    if (action.type === 'pause') isLive = false;
    if (action.type === 'rotate') console.log('Camera flip');
    if (action.type === 'size') videoQuality = action.value;
    if (action.type === 'speed') videoSpeed = action.value;
    
    socket.broadcast.emit('phone_command', { cmd: action.type, val: action.value });
    io.emit('live_status', { streaming: isLive, count: phones.length, quality: videoQuality, fps: videoSpeed });
  });

  // Phone leaves
  socket.on('disconnect', () => {
    const idx = phones.findIndex(p => p.sid === socket.id);
    if (idx !== -1) {
      phones.splice(idx, 1);
      console.log(`❌ Phone removed`);
      io.emit('phone_list', phones);
      io.emit('live_status', { streaming: isLive, count: phones.length, quality: videoQuality, fps: videoSpeed });
    }
  });

  // Send initial data
  socket.emit('phone_list', phones);
  socket.emit('live_status', { streaming: isLive, count: phones.length, quality: videoQuality, fps: videoSpeed });
});

// Web Dashboard
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CAM DASH</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: radial-gradient(circle at 20% 50%, #0a0f1e, #06090f);
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            min-height: 100vh;
            padding: 24px 16px;
        }
        
        /* Glass morphism container */
        .dashboard {
            max-width: 550px;
            margin: 0 auto;
        }
        
        /* Header with neon glow */
        .brand {
            text-align: center;
            margin-bottom: 28px;
        }
        .brand h1 {
            font-size: 36px;
            font-weight: 800;
            background: linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -1px;
            text-shadow: 0 0 30px rgba(0,212,255,0.3);
        }
        .brand p {
            color: #6b7280;
            font-size: 11px;
            letter-spacing: 2px;
            margin-top: 6px;
        }
        
        /* Stats row - neon cards */
        .stats-row {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
        }
        .stat-card {
            flex: 1;
            background: rgba(15, 25, 35, 0.7);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            padding: 14px 8px;
            text-align: center;
            border: 1px solid rgba(0, 212, 255, 0.2);
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .stat-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #9ca3af;
            letter-spacing: 1.5px;
            margin-bottom: 6px;
        }
        .stat-number {
            font-size: 28px;
            font-weight: 800;
            color: #00d4ff;
            text-shadow: 0 0 8px #00d4ff;
        }
        .stat-live {
            color: #ff3366;
            text-shadow: 0 0 8px #ff3366;
            animation: pulse 0.8s infinite;
        }
        @keyframes pulse {
            0%,100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        /* Video window - modern frame */
        .screen {
            background: #000000;
            border-radius: 32px;
            overflow: hidden;
            margin-bottom: 24px;
            position: relative;
            border: 1px solid rgba(0, 212, 255, 0.4);
            box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 2px rgba(0,212,255,0.1);
            aspect-ratio: 16/9;
        }
        #videoPlayer {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: none;
        }
        .fallback {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #374151;
        }
        .fallback span {
            font-size: 56px;
            display: block;
            margin-bottom: 12px;
            opacity: 0.5;
        }
        .full-trigger {
            position: absolute;
            bottom: 16px;
            right: 16px;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px);
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 30px;
            font-size: 20px;
            cursor: pointer;
            z-index: 20;
            transition: all 0.2s;
        }
        .full-trigger:hover {
            background: #00d4ff;
            transform: scale(1.05);
        }
        
        /* Control panel - floating glass */
        .remote {
            background: rgba(15, 25, 35, 0.7);
            backdrop-filter: blur(10px);
            border-radius: 32px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid rgba(0, 212, 255, 0.2);
        }
        .section-head {
            font-size: 11px;
            color: #9ca3af;
            letter-spacing: 1.5px;
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .button-pack {
            display: flex;
            gap: 12px;
            margin-bottom: 28px;
        }
        .ctrl-btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 60px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .ctrl-play {
            background: linear-gradient(135deg, #00d4ff, #0099cc);
            color: white;
            box-shadow: 0 4px 15px rgba(0,212,255,0.3);
        }
        .ctrl-stop {
            background: linear-gradient(135deg, #ff3366, #cc0044);
            color: white;
            box-shadow: 0 4px 15px rgba(255,51,102,0.3);
        }
        .ctrl-rotate {
            background: linear-gradient(135deg, #7c3aed, #5b21b6);
            color: white;
            box-shadow: 0 4px 15px rgba(124,58,237,0.3);
        }
        .ctrl-btn:active {
            transform: scale(0.96);
        }
        
        /* Quality pills */
        .pill-group {
            display: flex;
            gap: 10px;
            margin-bottom: 28px;
            flex-wrap: wrap;
        }
        .pill {
            flex: 1;
            background: #1a1f2e;
            padding: 10px;
            text-align: center;
            border-radius: 40px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border: 1px solid #2a2f3e;
            transition: all 0.2s;
            color: #9ca3af;
        }
        .pill-active {
            background: linear-gradient(135deg, #00d4ff, #7c3aed);
            color: white;
            border: none;
            box-shadow: 0 0 12px rgba(0,212,255,0.5);
        }
        
        /* Speed dial */
        .speed-control {
            margin-top: 8px;
        }
        .dial {
            width: 100%;
            height: 5px;
            -webkit-appearance: none;
            background: #1a1f2e;
            border-radius: 5px;
            margin: 15px 0;
        }
        .dial::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            background: #00d4ff;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 0 10px #00d4ff;
        }
        .speed-label {
            text-align: center;
            font-size: 13px;
            color: #00d4ff;
            font-weight: 600;
        }
        
        /* Phone list - minimal */
        .devices-panel {
            background: rgba(15, 25, 35, 0.7);
            backdrop-filter: blur(10px);
            border-radius: 32px;
            padding: 20px;
            border: 1px solid rgba(0, 212, 255, 0.2);
        }
        .phone-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px;
            background: rgba(0,0,0,0.3);
            border-radius: 20px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
        }
        .phone-item.selected {
            border-color: #00d4ff;
            background: rgba(0,212,255,0.1);
            box-shadow: 0 0 12px rgba(0,212,255,0.2);
        }
        .phone-name {
            font-weight: 600;
            font-size: 14px;
        }
        .phone-badge {
            width: 10px;
            height: 10px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 6px #10b981;
        }
        .empty-msg {
            text-align: center;
            color: #4b5563;
            padding: 30px;
        }
        
        /* Scroll */
        ::-webkit-scrollbar {
            width: 4px;
        }
        ::-webkit-scrollbar-track {
            background: #0a0f1e;
        }
        ::-webkit-scrollbar-thumb {
            background: #00d4ff;
            border-radius: 10px;
        }
    </style>
</head>
<body>
<div class="dashboard">
    <div class="brand">
        <h1>◈ CAM DASH ◈</h1>
        <p>CRYSTAL CONTROL</p>
    </div>
    
    <div class="stats-row">
        <div class="stat-card"><div class="stat-label">STATE</div><div class="stat-number" id="stateBadge">▸</div></div>
        <div class="stat-card"><div class="stat-label">NODES</div><div class="stat-number" id="nodeCount">0</div></div>
        <div class="stat-card"><div class="stat-label">HZ</div><div class="stat-number" id="hzCount">0</div></div>
    </div>
    
    <div class="screen" id="screenBox">
        <img id="videoPlayer">
        <div id="videoGhost" class="fallback"><span>📡</span><br>signal waiting</div>
        <button class="full-trigger" id="fullBtn">⛶</button>
    </div>
    
    <div class="remote">
        <div class="section-head"><span>🎮</span> COMMAND DECK</div>
        <div class="button-pack">
            <button class="ctrl-btn ctrl-play" id="playBtn">▶ PLAY</button>
            <button class="ctrl-btn ctrl-stop" id="stopBtn">⏹ STOP</button>
            <button class="ctrl-btn ctrl-rotate" id="rotateBtn">⟳ FLIP</button>
        </div>
        
        <div class="section-head"><span>📐</span> RESOLUTION</div>
        <div class="pill-group">
            <div class="pill" data-res="120">120p</div>
            <div class="pill" data-res="140">140p</div>
            <div class="pill pill-active" data-res="240">240p</div>
            <div class="pill" data-res="360">360p</div>
        </div>
        
        <div class="section-head"><span>⚡</span> REFRESH RATE</div>
        <div class="speed-control">
            <input type="range" id="fpsKnob" min="5" max="30" value="15" step="1" class="dial">
            <div class="speed-label" id="fpsShow">15 fps</div>
        </div>
    </div>
    
    <div class="devices-panel">
        <div class="section-head"><span>📱</span> ACTIVE NODES</div>
        <div id="phoneContainer"><div class="empty-msg">└ no devices ──</div></div>
    </div>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
let streamActive = false;
let frameRate = 0;
let lastMark = Date.now();
let selectedPhone = null;

// Elements
const videoImg = document.getElementById('videoPlayer');
const videoGhost = document.getElementById('videoGhost');
const stateBadge = document.getElementById('stateBadge');
const nodeCountSpan = document.getElementById('nodeCount');
const hzCountSpan = document.getElementById('hzCount');
const phoneContainer = document.getElementById('phoneContainer');
const playCtrl = document.getElementById('playBtn');
const stopCtrl = document.getElementById('stopBtn');
const rotateCtrl = document.getElementById('rotateBtn');
const fpsKnob = document.getElementById('fpsKnob');
const fpsShow = document.getElementById('fpsShow');
const fullBtn = document.getElementById('fullBtn');
const screenBox = document.getElementById('screenBox');

// Fullscreen toggle
fullBtn.onclick = () => {
    if (!document.fullscreenElement) {
        screenBox.requestFullscreen();
        fullBtn.innerHTML = '✕';
    } else {
        document.exitFullscreen();
        fullBtn.innerHTML = '⛶';
    }
};
document.addEventListener('fullscreenchange', () => {
    fullBtn.innerHTML = document.fullscreenElement ? '✕' : '⛶';
});

// Video feed
socket.on('video_feed', (data) => {
    if (data && data.img && streamActive) {
        videoImg.src = 'data:image/jpeg;base64,' + data.img;
        videoImg.style.display = 'block';
        videoGhost.style.display = 'none';
        frameRate++;
        const now = Date.now();
        if (now - lastMark >= 1000) {
            hzCountSpan.innerText = frameRate;
            frameRate = 0;
            lastMark = now;
        }
    }
});

// Phone list
socket.on('phone_list', (list) => {
    nodeCountSpan.innerText = list.length;
    if (list.length === 0) {
        phoneContainer.innerHTML = '<div class="empty-msg">└ no devices ──</div>';
        return;
    }
    phoneContainer.innerHTML = list.map(p => 
        '<div class="phone-item" onclick="pickPhone(\'' + p.sid + '\')" data-id="' + p.sid + '">' +
            '<span class="phone-name">📡 ' + p.title + '</span>' +
            '<div class="phone-badge"></div>' +
        '</div>'
    ).join('');
});

// Live status
socket.on('live_status', (status) => {
    streamActive = status.streaming;
    if (status.streaming) {
        stateBadge.innerHTML = '● LIVE';
        stateBadge.className = 'stat-number stat-live';
    } else {
        stateBadge.innerHTML = '▸ IDLE';
        stateBadge.className = 'stat-number';
    }
    nodeCountSpan.innerText = status.count;
});

// Pick phone
window.pickPhone = (id) => {
    selectedPhone = id;
    document.querySelectorAll('.phone-item').forEach(el => el.classList.remove('selected'));
    const active = document.querySelector('.phone-item[data-id="' + id + '"]');
    if (active) active.classList.add('selected');
};

// Send remote command
function sendRemote(type, val) {
    socket.emit('remote_action', { type: type, value: val });
}

// Control buttons
playCtrl.onclick = () => { sendRemote('play'); streamActive = true; };
stopCtrl.onclick = () => { sendRemote('pause'); streamActive = false; videoImg.style.display = 'none'; videoGhost.style.display = 'block'; hzCountSpan.innerText = '0'; };
rotateCtrl.onclick = () => sendRemote('rotate');

// Resolution pills
document.querySelectorAll('.pill').forEach(p => {
    p.onclick = () => {
        document.querySelectorAll('.pill').forEach(x => x.classList.remove('pill-active'));
        p.classList.add('pill-active');
        sendRemote('size', parseInt(p.dataset.res));
    };
});

// FPS knob
fpsKnob.oninput = () => {
    let val = parseInt(fpsKnob.value);
    fpsShow.innerText = val + ' fps';
    sendRemote('speed', val);
};
</script>
</body>
</html>`);
});

// Start engine
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════╗`);
  console.log(`║  🔮 CAM DASH ONLINE 🔮    ║`);
  console.log(`╠════════════════════════════╣`);
  console.log(`║  PORT: ${PORT}                  ║`);
  console.log(`║  UI:  http://localhost:${PORT}  ║`);
  console.log(`╚════════════════════════════╝\n`);
});
