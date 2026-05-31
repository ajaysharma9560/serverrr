const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store devices
const devices = new Map();

/* =========================
   FRONTEND (OPTIONAL UI)
========================= */
app.get("/", (req, res) => {
  res.send("🚀 Backend Running - Camera Stream Server");
});

/* =========================
   COMMAND API (Frontend → Backend → APK)
========================= */
app.post("/command", (req, res) => {
  const { command, quality, width, height } = req.body;

  console.log("📩 Command:", command);

  // send command to all connected devices
  for (let [id] of devices) {
    const socket = io.sockets.sockets.get(id);
    if (socket) {
      socket.emit("command", { command, quality, width, height });
    }
  }

  res.json({ success: true });
});

/* =========================
   SOCKET CONNECTION
========================= */
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  // register device (APK)
  socket.on("register_device", (data) => {
    devices.set(socket.id, {
      id: socket.id,
      name: data?.name || "Unknown",
      model: data?.model || "Unknown"
    });

    io.emit("device_list_update", Array.from(devices.values()));
  });

  // receive frame from APK
  socket.on("frame", (data) => {
    // broadcast to frontend
    socket.broadcast.emit("frame", data);
  });

  // resolution update
  socket.on("resolution_update", (data) => {
    socket.broadcast.emit("resolution_update", data);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    if (devices.has(socket.id)) {
      devices.delete(socket.id);
      io.emit("device_list_update", Array.from(devices.values()));
    }
  });
});

/* =========================
   MJPEG STREAM (OPTIONAL)
   (agar future me use karna ho)
========================= */
app.get("/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type":
      "multipart/x-mixed-replace; boundary=frame"
  });

  // dummy loop (replace with real camera frames)
  const interval = setInterval(() => {
    const fakeFrame = Buffer.from("fake"); // replace with JPEG buffer

    res.write("--frame\r\n");
    res.write("Content-Type: image/jpeg\r\n\r\n");
    res.write(fakeFrame);
    res.write("\r\n");
  }, 100);

  req.on("close", () => {
    clearInterval(interval);
  });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
