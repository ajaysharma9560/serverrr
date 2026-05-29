const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  } 
});

// HTML content embedded in server.js
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Camera Stream Controller</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            min-height: 100vh;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(0,0,0,0.3);
            border-radius: 20px;
            padding: 20px;
        }
        
        h1 {
            margin-bottom: 20px;
            font-size: 2em;
        }
        
        .status {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 50px;
            font-weight: bold;
            margin: 20px 0;
        }
        
        .online {
            background: #22c55e;
            animation: pulse 2s infinite;
        }
        
        .offline {
            background: #ef4444;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .quality-buttons {
            margin: 20px 0;
        }
        
        .quality-btn {
            background: #1e293b;
            color: white;
            padding: 10px 20px;
            margin: 5px;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s;
        }
        
        .quality-btn.active {
            background: #22c55e;
            transform: scale(1.05);
        }
        
        .control-btn {
            padding: 12px 30px;
            margin: 10px;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            transition: all 0.3s;
        }
        
        .start {
            background: #22c55e;
            color: white;
        }
        
        .stop {
            background: #ef4444;
            color: white;
        }
        
        .flip {
            background: #3b82f6;
            color: white;
        }
        
        .control-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        
        .stream-container {
            margin-top: 30px;
            background: #000;
            border-radius: 10px;
            overflow: hidden;
        }
        
        #streamImg {
            width: 100%;
            max-height: 500px;
            object-fit: contain;
        }
        
        .info {
            margin-top: 20px;
            padding: 10px;
            background: rgba(0,0,0,0.5);
            border-radius: 10px;
        }
        
        .device-id {
            font-family: monospace;
            background: #1e293b;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
        }
        
        .stats {
            display: flex;
            justify-content: space-around;
            margin-top: 10px;
        }
        
        .stat-box {
            background: rgba(0,0,0,0.5);
            padding: 10px;
            border-radius: 10px;
            min-width: 100px;
        }
        
        .stat-label {
            font-size: 12px;
            opacity: 0.8;
        }
        
        .stat-value {
            font-size: 24px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📷 Live Camera Stream</h1>
        
        <div id="status" class="status offline">● OFFLINE</div>
        
        <div class="quality-buttons">
            <button class="quality-btn" data-quality="140p">140p (Low)</button>
            <button class="quality-btn active" data-quality="240p">240p (Medium)</button>
            <button class="quality-btn" data-quality="360p">360p (High)</button>
        </div>
        
        <div>
            <button class="control-btn start" id="startBtn">▶ START STREAM</button>
            <button class="control-btn stop" id="stopBtn">⏹ STOP STREAM</button>
            <button class="control-btn flip" id="flipBtn">🔄 FLIP CAMERA</button>
        </div>
        
        <div class="stream-container">
            <img id="streamImg" src="" alt="Waiting for stream...">
        </div>
        
        <div class="info">
            <div class="stats">
                <div class="stat-box">
                    <div class="stat-label">📱 FPS</div>
                    <div class="stat-value" id="fps">0</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">📡 Clients</div>
                    <div class="stat-value" id="clients">0</div>
                </div>
            </div>
            <p class="device-id" style="margin-top: 10px;">🔗 Connect Android app to this server</p>
        </div>
    </div>
    
    <script>
        // Auto-detect server URL
        const socket = io();
        
        const statusSpan = document.getElementById('status');
        const streamImg = document.getElementById('streamImg');
        const fpsSpan = document.getElementById('fps');
        const clientsSpan = document.getElementById('clients');
        
        let frameCount = 0;
        let lastTime = Date.now();
        
        // Update FPS counter
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
        
        // Socket events
        socket.on('connect', () => {
            console.log('Connected to server');
            statusSpan.innerHTML = '● ONLINE';
            statusSpan.className = 'status online';
        });
        
        socket.on('disconnect', () => {
            statusSpan.innerHTML = '● OFFLINE';
            statusSpan.className = 'status offline';
        });
        
        socket.on('frame', (data) => {
            streamImg.src = data;
            frameCount++;
        });
        
        socket.on('clients', (count) => {
            clientsSpan.textContent = count;
        });
        
        // Button controls
        document.getElementById('startBtn').onclick = () => {
            socket.emit('command', 'start');
            showToast('🎥 Starting stream...');
        };
        
        document.getElementById('stopBtn').onclick = () => {
            socket.emit('command', 'stop');
            showToast('⏹ Stopping stream...');
        };
        
        document.getElementById('flipBtn').onclick = () => {
            socket.emit('command', 'flip');
            showToast('🔄 Flipping camera...');
        };
        
        // Quality buttons
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const quality = btn.dataset.quality;
                socket.emit('quality', quality);
                showToast(\`🎨 Quality changed to \${quality}\`);
            };
        });
        
        function showToast(message) {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'rgba(0,0,0,0.9)';
            toast.style.color = 'white';
            toast.style.padding = '12px 24px';
            toast.style.borderRadius = '10px';
            toast.style.zIndex = '1000';
            toast.style.fontSize = '14px';
            toast.style.fontWeight = 'bold';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
    </script>
</body>
</html>
`;

// Serve HTML
app.get('/', (req, res) => {
  res.send(htmlContent);
});

// Keep server alive
setInterval(() => {
  console.log('✅ Server is running...');
}, 30000);

// Socket.io connections
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log('📱 Client connected:', socket.id);
  console.log('Total clients:', connectedClients);
  
  // Send client count to all
  io.emit('clients', connectedClients);
  
  // Receive frame from Android
  socket.on('frame', (data) => {
    socket.broadcast.emit('frame', data);
  });
  
  // Send command to Android
  socket.on('command', (cmd) => {
    console.log('🎮 Command received:', cmd);
    socket.broadcast.emit('command', cmd);
  });
  
  // Send quality to Android  
  socket.on('quality', (quality) => {
    console.log('🎨 Quality changed:', quality);
    socket.broadcast.emit('quality', quality);
  });
  
  socket.on('disconnect', () => {
    connectedClients--;
    console.log('❌ Client disconnected:', socket.id);
    console.log('Total clients:', connectedClients);
    io.emit('clients', connectedClients);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🚀 Server Started!');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log('✅ Waiting for Android app to connect...');
});
