const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));

// ---------------- STATE ----------------
let latestFrame = null;
let isStreaming = false;

// ---------------- ANDROID FRAME INPUT ----------------
app.post("/frame", (req, res) => {
    try {
        if (!isStreaming) return res.sendStatus(403);

        latestFrame = req.body.frame;
        res.sendStatus(200);
    } catch (e) {
        res.sendStatus(500);
    }
});

// ---------------- START STREAM (FROM VERCEL) ----------------
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

// ---------------- STATUS ----------------
app.get("/status", (req, res) => {
    res.json({
        streaming: isStreaming,
        hasFrame: !!latestFrame
    });
});

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
