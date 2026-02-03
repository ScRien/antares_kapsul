const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ============= GLOBAL DATA =============
global.sensorHistory = [];
global.commandQueue = [];
global.webMessages = [];
let commandCounter = 0;

// ============= AUTHENTICATION =============
const SYSTEM_PASSWORD = process.env.SYSTEM_PASSWORD || "antares2026";
const validTokens = new Set();

function generateToken() {
  const token =
    "token_" + Math.random().toString(36).substring(2, 20) + Date.now();
  validTokens.add(token);
  return token;
}

function isValidToken(token) {
  return validTokens.has(token);
}

// ============= TOKEN MIDDLEWARE =============
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token eksik" });
  }

  if (isValidToken(token)) {
    next();
  } else {
    res.status(403).json({ message: "Gecersiz Token" });
  }
};

// ============= SENSÖR VERİSİ =============
let sensorData = {
  t: 22.5,
  h: 65,
  s: "Bagli",
  f1: 0,
  f2: 0,
  frameTimestamp: new Date().toLocaleTimeString("tr-TR"),
};

// ============= LIVE MODE =============
const liveMode = {
  active: false,
  endTime: null,
  duration: 5 * 60 * 1000, // 5 dakika
};

// ============= ADD COMMAND HELPER =============
function addCommand(type, value) {
  const cmd = {
    id: ++commandCounter,
    type: type,
    value: value,
    status: "pending",
    timestamp: new Date().toLocaleTimeString("tr-TR"),
  };
  global.commandQueue.push(cmd);

  setTimeout(() => {
    const index = global.commandQueue.findIndex((c) => c.id === cmd.id);
    if (index !== -1) global.commandQueue[index].status = "sent";
  }, 1000);

  setTimeout(() => {
    const index = global.commandQueue.findIndex((c) => c.id === cmd.id);
    if (index !== -1) global.commandQueue[index].status = "ack";
  }, 2000);
}

// ============= ROUTES SETUP =============

// Auth Routes
const authRoutes = require("./routes/auth")(
  SYSTEM_PASSWORD,
  generateToken,
  isValidToken,
  authenticateToken,
);
app.use("/api/auth", authRoutes);

// Sensor Routes
const sensorRoutes = require("./routes/sensor")(
  sensorData,
  global.sensorHistory,
  global.commandQueue,
  authenticateToken,
);
app.use("/api/sensor", sensorRoutes);

// Hardware Routes
const hardwareRoutes = require("./routes/hardware")(
  sensorData,
  global.webMessages,
  global.commandQueue,
  addCommand,
  authenticateToken,
);
app.use("/api/hardware", hardwareRoutes);

// Capture Routes
const captureRoutes = require("./routes/capture")(
  addCommand,
  authenticateToken,
);
app.use("/api", captureRoutes);

// Stream Routes
const streamRoutes = require("./routes/stream")(authenticateToken);
app.use("/api", streamRoutes);

// Live Mode Routes
const liveModeRoutes = require("./routes/livemode")(
  global.commandQueue,
  authenticateToken,
  liveMode,
);
app.use("/api", liveModeRoutes);

// Archive Routes
const archiveRoutes = require("./routes/archive")(authenticateToken);
app.use("/api/archive", archiveRoutes);

// Cleanup Routes
const cleanupRoutes = require("./routes/cleanup")(
  global.commandQueue,
  global.sensorHistory,
  global.webMessages,
  authenticateToken,
);
app.use("/api/cleanup", cleanupRoutes);

// Reports Routes (PDF)
const reportsRoutes = require("./routes/reports");
app.use("/api/reports", authenticateToken, reportsRoutes);

// ============= STATUS PAGE =============
app.get("/", (req, res) => {
  const pendingCount = global.commandQueue.filter(
    (c) => c.status === "pending",
  ).length;
  const ackedCount = global.commandQueue.filter(
    (c) => c.status === "ack",
  ).length;

  const html = `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ANTARES | Backend Status</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      </style>
  </head>
  <body class="p-6">
      <div class="max-w-4xl mx-auto">
          <div class="mb-8">
              <h1 class="text-4xl font-bold text-cyan-400 mb-2">ANTARES v2.1</h1>
              <p class="text-slate-400">Backend Status - ${new Date().toLocaleString("tr-TR")}</p>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div class="glass p-4 rounded-lg">
                  <p class="text-slate-400 text-xs uppercase">Sicaklik</p>
                  <p class="text-2xl font-bold mt-2">${sensorData.t}°C</p>
              </div>
              <div class="glass p-4 rounded-lg">
                  <p class="text-slate-400 text-xs uppercase">Nem</p>
                  <p class="text-2xl font-bold mt-2">%${sensorData.h}</p>
              </div>
              <div class="glass p-4 rounded-lg">
                  <p class="text-slate-400 text-xs uppercase">Bekleyen Komut</p>
                  <p class="text-2xl font-bold text-amber-400 mt-2">${pendingCount}</p>
              </div>
              <div class="glass p-4 rounded-lg">
                  <p class="text-slate-400 text-xs uppercase">Onaylanan</p>
                  <p class="text-2xl font-bold text-emerald-400 mt-2">${ackedCount}</p>
              </div>
          </div>

          <div class="glass p-6 rounded-lg mb-6">
              <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
                  <span class="w-3 h-3 bg-emerald-500 rounded-full ${liveMode.active ? "pulse" : ""}"></span>
                  Canli Mod: ${liveMode.active ? "<span class='text-emerald-400'>AKTIF</span>" : "<span class='text-slate-400'>INAKTIF</span>"}
              </h2>
              ${
                liveMode.active
                  ? `<p class="text-slate-300 text-sm">Bitis zamani: ${new Date(liveMode.endTime).toLocaleTimeString("tr-TR")}</p>`
                  : "<p class='text-slate-400 text-sm'>Canli mod su anda aktif degil</p>"
              }
          </div>

          <div class="glass p-6 rounded-lg">
              <h2 class="text-xl font-bold mb-4">Son Komutlar</h2>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                  ${
                    global.commandQueue.length === 0
                      ? '<p class="text-slate-500 text-sm">Henuz komut yok</p>'
                      : global.commandQueue
                          .slice()
                          .reverse()
                          .slice(0, 10)
                          .map(
                            (cmd) => `
                      <div class="bg-slate-800 p-3 rounded text-sm border-l-2 ${
                        cmd.status === "pending"
                          ? "border-amber-500"
                          : cmd.status === "sent"
                            ? "border-sky-500"
                            : "border-emerald-500"
                      }">
                          <div class="flex justify-between">
                              <span>#${cmd.id} - ${cmd.type}</span>
                              <span class="text-xs font-bold">${cmd.status.toUpperCase()}</span>
                          </div>
                      </div>
                    `,
                          )
                          .join("")
                  }
              </div>
          </div>

          <div class="mt-8 glass p-6 rounded-lg">
              <h2 class="text-xl font-bold mb-4">API Endpoints</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                  <div>
                      <p class="font-bold text-cyan-400 mb-2">Authentication</p>
                      <ul class="space-y-1 text-xs">
                          <li>POST /api/auth/login</li>
                          <li>POST /api/auth/verify</li>
                          <li>POST /api/auth/refresh</li>
                      </ul>
                  </div>
                  <div>
                      <p class="font-bold text-cyan-400 mb-2">Hardware</p>
                      <ul class="space-y-1 text-xs">
                          <li>GET /api/hardware/cmd</li>
                          <li>GET /api/stream</li>
                          <li>GET /api/capture</li>
                      </ul>
                  </div>
                  <div>
                      <p class="font-bold text-cyan-400 mb-2">Live Mode</p>
                      <ul class="space-y-1 text-xs">
                          <li>POST /api/live-mode-start</li>
                          <li>POST /api/live-mode-stop</li>
                          <li>GET /api/live-mode-status</li>
                      </ul>
                  </div>
                  <div>
                      <p class="font-bold text-cyan-400 mb-2">Sensor & Archive</p>
                      <ul class="space-y-1 text-xs">
                          <li>GET /api/sensor/data</li>
                          <li>GET /api/archive/list</li>
                          <li>GET /api/reports/pdf</li>
                      </ul>
                  </div>
              </div>
          </div>
      </div>
  </body>
  </html>`;

  res.send(html);
});

// ============= SERVER START =============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════════╗`);
  console.log(`║   ANTARES Backend v2.1 - SUCCESS              ║`);
  console.log(`╚════════════════════════════════════════════════╝\n`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔑 Sifre: antares2026`);
  console.log(`🌐 URL: http://localhost:${PORT}\n`);
  console.log(`✅ Moduler Routes Aktif:`);
  console.log(`   • /api/auth - Authentication`);
  console.log(`   • /api/sensor - Sensor Data`);
  console.log(`   • /api/hardware - Hardware Control`);
  console.log(`   • /api/stream - Live Stream`);
  console.log(`   • /api/live-mode-* - Live Mode`);
  console.log(`   • /api/archive - Archive Management`);
  console.log(`   • /api/cleanup - Data Cleanup`);
  console.log(`   • /api/reports - PDF Reports\n`);
  console.log(`📊 Status Page: http://localhost:${PORT}\n`);
});
