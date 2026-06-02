const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// limit for image frames
app.use(express.json({ limit: "50mb" }));

// ---------------- STATE ----------------
let latestFrame = null;
let isStreaming = false;

// ---------------- ROOT (FIX "Cannot GET /") ----------------
app.get("/", (req, res) => {
    res.send("✅ Server Running Successfully");
});

// ---------------- START STREAM ----------------
app.post("/start", (req, res) => {
    isStreaming = true;
    console.log("STREAM STARTED");
    res.json({ status: "started" });
});

// ---------------- STOP STREAM ----------------
app.post("/stop", (req, res) => {
    isStreaming = false;
    latestFrame = null;
    console.log("STREAM STOPPED");
    res.json({ status: "stopped" });
});

// ---------------- RECEIVE FRAME FROM ANDROID ----------------
app.post("/frame", (req, res) => {
    try {
        if (!isStreaming) return res.sendStatus(403);

        latestFrame = req.body.frame;
        res.sendStatus(200);
    } catch (e) {
        res.sendStatus(500);
    }
});

// ---------------- MJPEG STREAM (BROWSER VIEW) ----------------
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

    }, 100); // 10 FPS

    req.on("close", () => {
        clearInterval(interval);
    });
});

// ---------------- STATUS CHECK ----------------
app.get("/status", (req, res) => {
    res.json({
        streaming: isStreaming,
        hasFrame: !!latestFrame
    });
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
