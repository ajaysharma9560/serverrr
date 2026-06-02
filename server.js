const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));

let devices = {};
let latestFrame = null;
let isStreaming = false;

// ================= ROOT UI =================
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mobile CCTV Dashboard</title>

<style>
body {
    margin:0;
    font-family:Arial;
    background:#0b0b0b;
    color:white;
}

/* HEADER */
.header {
    text-align:center;
    padding:10px;
    background:#111;
    font-size:16px;
}

/* LAYOUT */
.container {
    display:flex;
    flex-direction:column;
}

/* DEVICES */
.devices {
    background:#161616;
    padding:10px;
    max-height:120px;
    overflow:auto;
    font-size:13px;
}

.device {
    padding:6px;
    margin:5px 0;
    background:#222;
    border-radius:6px;
}

.online { color:#00ff88; }
.offline { color:#ff4d4d; }

/* LIVE PLAYER */
.player {
    margin:10px;
    background:black;
    border-radius:12px;
    overflow:hidden;
    border:2px solid #333;
}

.player-header {
    background:#1c1c1c;
    padding:8px;
    font-size:13px;
    text-align:center;
}

/* VIDEO */
img {
    width:100%;
    height:auto;
    display:block;
}

/* CONTROLS */
.controls {
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    padding:10px;
    gap:8px;
}

button {
    flex:1;
    min-width:90px;
    padding:12px;
    border:none;
    border-radius:8px;
    font-size:14px;
    color:white;
}

.start { background:#1db954; }
.stop { background:#e53935; }
.flip { background:#ff9800; }
.q { background:#1976d2; }

@media (min-width: 768px) {
    .container {
        flex-direction:row;
    }

    .devices {
        width:25%;
        max-height:100vh;
    }

    .main {
        width:75%;
    }
}
</style>
</head>

<body>

<div class="header">📡 MOBILE CCTV DASHBOARD</div>

<div class="container">

<!-- DEVICES -->
<div class="devices">
<h4>📱 Devices</h4>
<div id="devices">Loading...</div>
</div>

<!-- MAIN -->
<div class="main">

<!-- PLAYER -->
<div class="player">
    <div class="player-header">🔴 LIVE STREAM</div>
    <img src="/stream">
</div>

<!-- CONTROLS -->
<div class="controls">
<button class="start" onclick="start()">START</button>
<button class="stop" onclick="stop()">STOP</button>
<button class="flip" onclick="flip()">FLIP</button>
</div>

<div class="controls">
<button class="q" onclick="quality('120p')">120p</button>
<button class="q" onclick="quality('240p')">240p</button>
<button class="q" onclick="quality('360p')">360p</button>
</div>

</div>
</div>

<script>

async function start(){
  await fetch("/start",{method:"POST"});
}

async function stop(){
  await fetch("/stop",{method:"POST"});
}

async function flip(){
  await fetch("/flip",{method:"POST"});
}

async function quality(q){
  await fetch("/quality",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({quality:q})
  });
}

async function loadDevices(){
  const res = await fetch("/devices");
  const data = await res.json();

  let html = "";

  Object.values(data).forEach(d=>{
    html += `<div class="device">
      <b>${d.name}</b><br>
      ${d.model}<br>
      <span class="${d.status==='ONLINE'?'online':'offline'}">
        ${d.status}
      </span>
    </div>`;
  });

  document.getElementById("devices").innerHTML = html || "No devices";
}

setInterval(loadDevices,3000);
loadDevices();

</script>

</body>
</html>
    `);
});

// ================= STREAM =================
app.get("/stream", (req, res) => {

    res.writeHead(200, {
        "Content-Type": "multipart/x-mixed-replace; boundary=frame",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });

    const interval = setInterval(() => {

        if (!isStreaming || !latestFrame) return;

        const img = Buffer.from(
            latestFrame.replace("data:image/jpeg;base64,", ""),
            "base64"
        );

        res.write("--frame\r\n");
        res.write("Content-Type: image/jpeg\r\n");
        res.write("Content-Length: " + img.length + "\r\n\r\n");
        res.write(img);
        res.write("\r\n");

    }, 100);

    req.on("close", () => clearInterval(interval));
});

// ================= CONTROL =================
app.post("/start", (req, res) => {
    isStreaming = true;
    res.json({ status: "started" });
});

app.post("/stop", (req, res) => {
    isStreaming = false;
    latestFrame = null;
    res.json({ status: "stopped" });
});

// ================= FRAME =================
app.post("/frame", (req, res) => {
    if (!isStreaming) return res.sendStatus(403);
    latestFrame = req.body.frame;
    res.sendStatus(200);
});

// ================= DEVICE SYSTEM =================
app.post("/register_device", (req, res) => {

    const id = req.body.deviceId || Date.now().toString();

    devices[id] = {
        id,
        name: req.body.name,
        model: req.body.model,
        status: "ONLINE",
        lastSeen: Date.now()
    };

    res.json({ ok: true });
});

app.post("/heartbeat", (req, res) => {
    const id = req.body.deviceId;
    if (devices[id]) {
        devices[id].status = "ONLINE";
        devices[id].lastSeen = Date.now();
    }
    res.sendStatus(200);
});

// auto offline detection
setInterval(() => {
    const now = Date.now();
    Object.values(devices).forEach(d => {
        if (now - d.lastSeen > 10000) d.status = "OFFLINE";
    });
}, 5000);

// ================= DEVICES =================
app.get("/devices", (req, res) => {
    res.json(devices);
});

app.listen(PORT, () => {
    console.log("🚀 MOBILE SERVER RUNNING ON " + PORT);
});
