<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Camera Controller</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Poppins', sans-serif;
            min-height: 100vh;
            padding: 20px;
        }

        /* Main Container */
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        /* Glassmorphism Card */
        .glass-card {
            background: rgba(15, 25, 35, 0.7);
            backdrop-filter: blur(12px);
            border-radius: 28px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        /* Header */
        .header {
            text-align: center;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 28px;
            font-weight: 600;
            background: linear-gradient(135deg, #fff, #a0c0ff);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            letter-spacing: -0.5px;
        }

        .header p {
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
            margin-top: 5px;
        }

        /* Grid Layout */
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: 20px;
        }

        /* Video Section */
        .video-section {
            text-align: center;
        }

        .video-title {
            font-size: 18px;
            font-weight: 500;
            color: white;
            margin-bottom: 15px;
            text-align: left;
        }

        .video-container {
            background: #000000;
            border-radius: 20px;
            overflow: hidden;
            aspect-ratio: 16 / 9;
            position: relative;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .video-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .no-stream {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: rgba(255, 255, 255, 0.5);
        }

        .no-stream span {
            font-size: 48px;
            display: block;
            margin-bottom: 10px;
        }

        /* Stats Row */
        .stats-row {
            display: flex;
            justify-content: space-around;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .stat-card {
            background: rgba(0, 0, 0, 0.4);
            border-radius: 16px;
            padding: 12px;
            flex: 1;
            text-align: center;
            backdrop-filter: blur(4px);
        }

        .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #00ff88;
        }

        .stat-label {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* Control Buttons */
        .control-buttons {
            display: flex;
            gap: 15px;
            margin-bottom: 25px;
        }

        .btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 40px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .btn-start {
            background: linear-gradient(135deg, #00b894, #00cec9);
            color: white;
            box-shadow: 0 4px 15px rgba(0, 184, 148, 0.3);
        }

        .btn-stop {
            background: linear-gradient(135deg, #d63031, #ff7675);
            color: white;
            box-shadow: 0 4px 15px rgba(214, 48, 49, 0.3);
        }

        .btn-flip {
            background: linear-gradient(135deg, #0984e3, #74b9ff);
            color: white;
            box-shadow: 0 4px 15px rgba(9, 132, 227, 0.3);
        }

        .btn:hover {
            transform: translateY(-2px);
            filter: brightness(1.05);
        }

        .btn:active {
            transform: translateY(0);
        }

        /* Quality Section */
        .quality-section {
            margin-top: 10px;
        }

        .section-title {
            font-size: 14px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .quality-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .quality-btn {
            flex: 1;
            padding: 10px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 40px;
            color: white;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
        }

        .quality-btn:hover {
            background: rgba(0, 255, 136, 0.3);
            border-color: #00ff88;
        }

        .quality-btn.active {
            background: #00ff88;
            color: #1a1a2e;
            border-color: #00ff88;
        }

        /* Device Section */
        .device-card {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 20px;
            padding: 16px;
            margin-bottom: 15px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .device-name {
            font-size: 16px;
            font-weight: 600;
            color: white;
            margin-bottom: 8px;
        }

        .device-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 20px;
            background: rgba(0, 255, 136, 0.15);
            color: #00ff88;
            margin-bottom: 8px;
        }

        .device-status.offline {
            background: rgba(255, 0, 0, 0.15);
            color: #ff6b6b;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #00ff88;
            display: inline-block;
            animation: pulse 1.5s infinite;
        }

        .status-dot.offline {
            background: #ff6b6b;
            animation: none;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }

        .device-info {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.5);
            margin-top: 8px;
        }

        /* Error Notification */
        .error-toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(214, 48, 49, 0.95);
            backdrop-filter: blur(10px);
            padding: 12px 24px;
            border-radius: 50px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            animation: slideUp 0.3s ease;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        /* Responsive */
        @media (max-width: 768px) {
            .dashboard-grid {
                grid-template-columns: 1fr;
            }
            
            body {
                padding: 12px;
            }
            
            .glass-card {
                padding: 18px;
            }
            
            .stat-value {
                font-size: 22px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>📷 Camera Controller</h1>
            <p>Live stream from your device</p>
        </div>

        <div class="dashboard-grid">
            <!-- Left: Video Section -->
            <div class="glass-card video-section">
                <div class="video-title">🎥 Live Preview</div>
                <div class="video-container">
                    <img id="videoFeed" src="" alt="Camera Feed">
                    <div id="noStreamOverlay" class="no-stream">
                        <span>📹</span>
                        <p>No active stream</p>
                    </div>
                </div>

                <!-- Stats -->
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-value" id="fpsValue">0</div>
                        <div class="stat-label">FPS</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="resolutionValue">-</div>
                        <div class="stat-label">Resolution</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="qualityValue">-</div>
                        <div class="stat-label">Quality</div>
                    </div>
                </div>

                <!-- Control Buttons -->
                <div class="control-buttons">
                    <button class="btn btn-start" id="startBtn">▶ Start</button>
                    <button class="btn btn-stop" id="stopBtn">⏹ Stop</button>
                    <button class="btn btn-flip" id="flipBtn">🔄 Flip</button>
                </div>

                <!-- Quality Section -->
                <div class="quality-section">
                    <div class="section-title">📊 Stream Quality</div>
                    <div class="quality-buttons">
                        <button class="quality-btn" data-quality="120p">120p</button>
                        <button class="quality-btn" data-quality="140p">140p</button>
                        <button class="quality-btn" data-quality="240p">240p</button>
                        <button class="quality-btn" data-quality="360p">360p</button>
                        <button class="quality-btn" data-quality="480p">480p</button>
                    </div>
                </div>
            </div>

            <!-- Right: Device Info -->
            <div class="glass-card">
                <div class="section-title">📱 Device Status</div>
                <div id="deviceInfo">
                    <div class="device-card">
                        <div class="device-name" id="deviceName">OPPO CPH2061</div>
                        <div class="device-status" id="deviceStatus">
                            <span class="status-dot"></span>
                            <span id="statusText">Online</span>
                        </div>
                        <div class="device-info" id="deviceDetail">
                            • Connected<br>
                            • Ready to stream
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        
        // DOM Elements
        const videoFeed = document.getElementById('videoFeed');
        const noStreamOverlay = document.getElementById('noStreamOverlay');
        const fpsValue = document.getElementById('fpsValue');
        const resolutionValue = document.getElementById('resolutionValue');
        const qualityValue = document.getElementById('qualityValue');
        const deviceNameEl = document.getElementById('deviceName');
        const statusText = document.getElementById('statusText');
        const deviceStatusEl = document.getElementById('deviceStatus');
        const deviceDetail = document.getElementById('deviceDetail');
        
        // State
        let frameCount = 0;
        let lastFpsUpdate = Date.now();
        let currentQuality = '360p';
        
        // FPS Counter
        function updateFPS() {
            const now = Date.now();
            const delta = (now - lastFpsUpdate) / 1000;
            if (delta >= 1) {
                fpsValue.innerText = Math.round(frameCount / delta);
                frameCount = 0;
                lastFpsUpdate = now;
            }
            requestAnimationFrame(updateFPS);
        }
        updateFPS();
        
        // Socket Events
        socket.on('connect', () => {
            console.log('Connected to server');
            showError('✅ Connected to server', '#00ff88');
            updateDeviceStatus('online');
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected');
            showError('❌ Disconnected from server', '#ff6b6b');
            updateDeviceStatus('offline');
        });
        
        // Receive Frames
        socket.on('frame', (data) => {
            videoFeed.src = data;
            noStreamOverlay.style.display = 'none';
            frameCount++;
        });
        
        // Update Device List
        socket.on('devices', (devices) => {
            const deviceIds = Object.keys(devices);
            if (deviceIds.length > 0) {
                const device = devices[deviceIds[0]];
                deviceNameEl.innerText = device.name || 'Unknown Device';
                updateDeviceStatus(device.status);
                if (device.streaming) {
                    deviceDetail.innerHTML = '• Streaming active<br>• Connected';
                } else {
                    deviceDetail.innerHTML = '• Idle<br>• Connected';
                }
            }
        });
        
        // Command Status
        socket.on('command_status', (data) => {
            if (data.success) {
                showError('✅ ' + data.message, '#00ff88');
            } else {
                showError('❌ ' + data.message, '#ff6b6b');
            }
        });
        
        // Update device status UI
        function updateDeviceStatus(status) {
            if (status === 'online') {
                statusText.innerText = 'Online';
                deviceStatusEl.classList.remove('offline');
                deviceStatusEl.querySelector('.status-dot').classList.remove('offline');
            } else {
                statusText.innerText = 'Offline';
                deviceStatusEl.classList.add('offline');
                deviceStatusEl.querySelector('.status-dot').classList.add('offline');
            }
        }
        
        // Send Commands
        function sendCommand(cmd) {
            console.log('Sending:', cmd);
            socket.emit('command', cmd);
        }
        
        function sendQuality(quality) {
            currentQuality = quality;
            qualityValue.innerText = quality;
            socket.emit('command', { type: 'quality', value: quality });
            
            // Update active button style
            document.querySelectorAll('.quality-btn').forEach(btn => {
                if (btn.dataset.quality === quality) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        
        // Button Listeners
        document.getElementById('startBtn').addEventListener('click', () => {
            sendCommand('start');
            showError('▶ Starting stream...', '#0984e3');
        });
        
        document.getElementById('stopBtn').addEventListener('click', () => {
            sendCommand('stop');
            showError('⏹ Stopping stream...', '#d63031');
            noStreamOverlay.style.display = 'flex';
        });
        
        document.getElementById('flipBtn').addEventListener('click', () => {
            sendCommand('flip');
            showError('🔄 Flipping camera...', '#0984e3');
        });
        
        // Quality buttons
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const quality = btn.dataset.quality;
                sendQuality(quality);
                showError(`📊 Quality set to ${quality}`, '#00ff88');
            });
        });
        
        // Error/Success Toast
        let toastTimeout;
        function showError(message, color = '#ff6b6b') {
            // Remove existing toast
            const existing = document.querySelector('.error-toast');
            if (existing) existing.remove();
            if (toastTimeout) clearTimeout(toastTimeout);
            
            const toast = document.createElement('div');
            toast.className = 'error-toast';
            toast.style.background = color;
            toast.innerText = message;
            document.body.appendChild(toast);
            
            toastTimeout = setTimeout(() => {
                toast.remove();
            }, 3000);
        }
        
        // Set default quality active
        document.querySelector('.quality-btn[data-quality="360p"]').classList.add('active');
        qualityValue.innerText = '360p';
        resolutionValue.innerText = '640x480';
    </script>
</body>
</html>
