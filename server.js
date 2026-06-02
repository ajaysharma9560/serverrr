const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));

// ================= STATE =================
let devices = {};
let latestFrame = null;
let isStreaming = false;
let currentQuality = "240p";

// ================= ROOT DASHBOARD =================
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Live Camera System</title>
<style>
body { margin:0; font-family:Arial; background:#0f0f0f; color:white; }

.header {
  text-align:center;
  padding:10px;
  background:#111;
}

.container {
  display:flex;
  height:100vh;
}

.sidebar {
  width:25%;
  background:#1b1b1b;
  padding:10px;
  overflow:auto;
}

.main {
  width:75%;
  padding:10px;
  text-align:center;
}

.device {
  background:#333;
  margin:5px;
  padding:8px;
  border-radius:6px;
}

.online { color:lime; }
.offline { color:red; }

button {
  padding:10px;
  margin:5px;
  border:none;
  cursor:pointer;
  border-radius:5px;
}

.start { background:green; color:white; }
.stop { background:red; color:white; }
.flip { background:orange; }
.q { background:blue; color:white; }

img {
  width:90%;
  max-width:700px;
  border:2px solid #444;
}
</style>
</head>

<body>

<div class="header">
<h2>📡 LIVE CAMERA DASHBOARD</h2>
</div>

<div class="container">

<!-- SIDEBAR -->
<div class="sidebar">
<h3>📱 Devices</h3>
<div id="devices">Loading...</div>
</div>

<!-- MAIN -->
<div class="main">

<h3>🎥 Live Stream</h3>

<img src="/stream" />

<br>

<button class="start" onclick="start()">START</button>
<button class="stop" onclick="stop()">STOP</button>
<button class="flip" onclick="flip()">FLIP</button>

<br>

<button class="q" onclick="quality('120p')">120p</button>
<button class="q" onclick="quality('240p')">240p</button>
<button class="q" onclick="quality('360p')">360p</button>

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

  document.getElementById("devices").innerHTML = html || "No Devices";
}

setInterval(loadDevices,3000);
loadDevices();

</script>

</body>
</html>
    `);
});

// ================= DEVICE REGISTER =================
app.post("/register_device", (req, res) => {

    const id = req.body.deviceId || Date.now().toString();

    devices[id] = {
        id,
        name: req.body.name,
        model: req.body.model,
        type: req.body.type,
        status: "ONLINE",
        lastSeen: Date.now()
    };

    console.log("DEVICE ONLINE:", id);

    res.json({ status: "registered", id });
});

// ================= HEARTBEAT =================
app.post("/heartbeat", (req, res) => {

    const id = req.body.deviceId;

    if (devices[id]) {
        devices[id].status = "ONLINE";
        devices[id].lastSeen = Date.now();
    }

    res.sendStatus(200);
});

// ================= AUTO OFFLINE CHECK =================
setInterval(() => {

    const now = Date.now();

    Object.values(devices).forEach(d => {
        if (now - d.lastSeen > 10000) {
            d.status = "OFFLINE";
        }
    });

}, 5000);

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

app.post("/flip", (req, res) => {
    console.log("FLIP REQUEST");
    res.json({ status: "flip sent" });
});

app.post("/quality", (req, res) => {
    currentQuality = req.body.quality;
    console.log("QUALITY:", currentQuality);
    res.json({ status: currentQuality });
});

// ================= FRAME INPUT =================
app.post("/frame", (req, res) => {
    if (!isStreaming) return res.sendStatus(403);
    latestFrame = req.body.frame;
    res.sendStatus(200);
});

// ================= MJPEG STREAM =================
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

// ================= DEVICES API =================
app.get("/devices", (req, res) => {
    res.json(devices);
});

// ================= STATUS =================
app.get("/status", (req, res) => {
    res.json({
        streaming: isStreaming,
        quality: currentQuality,
        devices: Object.keys(devices).length
    });
});

// ================= START SERVER =================
app.listen(PORT, () => {
    console.log("🚀 SERVER RUNNING ON PORT " + PORT);
});
