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
  duration: 5 * 60 * 1000,
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

// ============= STATUS PAGE - ENHANCED =============
app.get("/", (req, res) => {
  const pendingCount = global.commandQueue.filter(
    (c) => c.status === "pending",
  ).length;
  const ackedCount = global.commandQueue.filter(
    (c) => c.status === "ack",
  ).length;
  const sentCount = global.commandQueue.filter(
    (c) => c.status === "sent",
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
        .gradient-text { background: linear-gradient(135deg, #00d2ff 0%, #10ac84 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .badge-success { background: rgba(16, 172, 132, 0.2); color: #10ac84; border: 1px solid #10ac84; }
        .badge-warning { background: rgba(251, 146, 60, 0.2); color: #fb923c; border: 1px solid #fb923c; }
        .badge-info { background: rgba(0, 210, 255, 0.2); color: #00d2ff; border: 1px solid #00d2ff; }
        .metric-card { transition: all 0.3s ease; }
        .metric-card:hover { transform: translateY(-2px); }
        table { width: 100%; border-collapse: collapse; }
        thead th { text-align: left; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #64748b; font-size: 0.85rem; font-weight: 600; }
        tbody td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        tbody tr:hover { background: rgba(255,255,255,0.02); }
      </style>
  </head>
  <body class="p-6">
      <div class="max-w-6xl mx-auto">
          <div class="mb-12">
              <div class="flex justify-between items-start mb-6">
                  <div>
                      <h1 class="text-5xl font-black mb-2 gradient-text">ANTARES</h1>
                      <p class="text-slate-400 text-lg">Backend Status Dashboard v2.1</p>
                  </div>
                  <div class="text-right">
                      <span class="status-badge badge-success">SISTEM ONLINE</span>
                      <p class="text-slate-400 text-sm mt-2">${new Date().toLocaleString("tr-TR")}</p>
                  </div>
              </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div class="glass p-4 rounded-xl metric-card">
                  <p class="text-slate-400 text-xs uppercase tracking-widest font-bold">Sicaklik</p>
                  <p class="text-3xl font-black mt-2 text-orange-400">${sensorData.t}°C</p>
              </div>
              <div class="glass p-4 rounded-xl metric-card">
                  <p class="text-slate-400 text-xs uppercase tracking-widest font-bold">Nem</p>
                  <p class="text-3xl font-black mt-2 text-blue-400">${sensorData.h}%</p>
              </div>
              <div class="glass p-4 rounded-xl metric-card">
                  <p class="text-slate-400 text-xs uppercase tracking-widest font-bold">Bekleyen</p>
                  <p class="text-3xl font-black mt-2 text-amber-400">${pendingCount}</p>
              </div>
              <div class="glass p-4 rounded-xl metric-card">
                  <p class="text-slate-400 text-xs uppercase tracking-widest font-bold">Gonderilen</p>
                  <p class="text-3xl font-black mt-2 text-sky-400">${sentCount}</p>
              </div>
              <div class="glass p-4 rounded-xl metric-card">
                  <p class="text-slate-400 text-xs uppercase tracking-widest font-bold">Onaylanan</p>
                  <p class="text-3xl font-black mt-2 text-emerald-400">${ackedCount}</p>
              </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              
              <div class="lg:col-span-2 space-y-6">
                  
                  <div class="glass p-6 rounded-xl border border-cyan-400/20">
                      <div class="flex justify-between items-center mb-4">
                          <div class="flex items-center gap-3">
                              <span class="w-4 h-4 bg-emerald-500 rounded-full ${liveMode.active ? "pulse" : ""}"></span>
                              <h2 class="text-xl font-bold">Canli Mod</h2>
                          </div>
                          <span class="status-badge ${liveMode.active ? "badge-success" : "badge-warning"}">
                              ${liveMode.active ? "AKTIF" : "INAKTIF"}
                          </span>
                      </div>
                      ${
                        liveMode.active
                          ? `<p class="text-slate-300 text-sm">
                             ⏱️ Bitis Zamani: <span class="text-cyan-400 font-bold">${new Date(liveMode.endTime).toLocaleTimeString("tr-TR")}</span>
                           </p>`
                          : "<p class='text-slate-400 text-sm'>Canli mod su anda aktif degil</p>"
                      }
                  </div>

                  <div class="glass p-6 rounded-xl">
                      <div class="flex justify-between items-center mb-4">
                          <h2 class="text-xl font-bold">Son Komutlar</h2>
                          <span class="text-sm text-slate-400">Toplam: ${global.commandQueue.length}</span>
                      </div>
                      <div class="space-y-2 max-h-96 overflow-y-auto">
                          ${
                            global.commandQueue.length === 0
                              ? '<p class="text-slate-500 text-sm py-8 text-center">Henuz komut yok</p>'
                              : global.commandQueue
                                  .slice()
                                  .reverse()
                                  .slice(0, 15)
                                  .map(
                                    (cmd) => `
                                    <div class="bg-slate-800/50 p-4 rounded-lg border-l-4 ${
                                      cmd.status === "pending"
                                        ? "border-amber-500"
                                        : cmd.status === "sent"
                                          ? "border-sky-500"
                                          : "border-emerald-500"
                                    } hover:bg-slate-800 transition">
                                        <div class="flex justify-between items-center">
                                            <div>
                                                <p class="font-semibold text-white">#${cmd.id} - ${cmd.type}</p>
                                                <p class="text-xs text-slate-400 mt-1">Deger: <span class="text-slate-300">${cmd.value}</span></p>
                                            </div>
                                            <div class="text-right">
                                                <span class="status-badge ${
                                                  cmd.status === "pending"
                                                    ? "badge-warning"
                                                    : cmd.status === "sent"
                                                      ? "badge-info"
                                                      : "badge-success"
                                                }">
                                                    ${cmd.status.toUpperCase()}
                                                </span>
                                                <p class="text-xs text-slate-400 mt-1">${cmd.timestamp}</p>
                                            </div>
                                        </div>
                                    </div>
                                  `,
                                  )
                                  .join("")
                          }
                      </div>
                  </div>

                  <div class="glass p-6 rounded-xl">
                      <h3 class="text-lg font-bold mb-4">Komut Kuyrugu Istatistikleri</h3>
                      <table>
                          <thead>
                              <tr>
                                  <th class="text-cyan-400">Durum</th>
                                  <th class="text-right text-cyan-400">Sayi</th>
                                  <th class="text-right text-cyan-400">Yuzde</th>
                              </tr>
                          </thead>
                          <tbody>
                              <tr>
                                  <td><span class="inline-block w-2 h-2 bg-amber-500 rounded-full mr-2"></span>Beklemede</td>
                                  <td class="text-right font-bold">${pendingCount}</td>
                                  <td class="text-right text-amber-400">${global.commandQueue.length > 0 ? ((pendingCount / global.commandQueue.length) * 100).toFixed(1) : 0}%</td>
                              </tr>
                              <tr>
                                  <td><span class="inline-block w-2 h-2 bg-sky-500 rounded-full mr-2"></span>Gonderilen</td>
                                  <td class="text-right font-bold">${sentCount}</td>
                                  <td class="text-right text-sky-400">${global.commandQueue.length > 0 ? ((sentCount / global.commandQueue.length) * 100).toFixed(1) : 0}%</td>
                              </tr>
                              <tr>
                                  <td><span class="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>Onaylanan</td>
                                  <td class="text-right font-bold">${ackedCount}</td>
                                  <td class="text-right text-emerald-400">${global.commandQueue.length > 0 ? ((ackedCount / global.commandQueue.length) * 100).toFixed(1) : 0}%</td>
                              </tr>
                          </tbody>
                      </table>
                  </div>

              </div>

              <div class="space-y-6">
                  
                  <div class="glass p-6 rounded-xl">
                      <h3 class="text-lg font-bold mb-4">Sistem Bilgisi</h3>
                      <div class="space-y-3 text-sm">
                          <div>
                              <p class="text-slate-400">Versiyon</p>
                              <p class="font-bold text-cyan-400">2.1.0</p>
                          </div>
                          <div>
                              <p class="text-slate-400">Sunucu Durumu</p>
                              <p class="font-bold text-emerald-400">CEVRIMICI</p>
                          </div>
                          <div>
                              <p class="text-slate-400">Sifre</p>
                              <p class="font-mono text-slate-300 text-xs">antares2026</p>
                          </div>
                          <div>
                              <p class="text-slate-400">Canli Mod Suresi</p>
                              <p class="font-bold text-blue-400">5 Dakika</p>
                          </div>
                          <div>
                              <p class="text-slate-400">Token Suresi</p>
                              <p class="font-bold text-blue-400">24 Saat</p>
                          </div>
                      </div>
                  </div>

                  <div class="glass p-6 rounded-xl">
                      <h3 class="text-lg font-bold mb-4">API Endpoint'leri</h3>
                      <div class="space-y-3 text-xs">
                          <div class="border-l-2 border-cyan-400 pl-3 py-1">
                              <p class="text-cyan-400 font-bold">Auth</p>
                              <p class="text-slate-400">3 endpoint</p>
                          </div>
                          <div class="border-l-2 border-blue-400 pl-3 py-1">
                              <p class="text-blue-400 font-bold">Sensor</p>
                              <p class="text-slate-400">3 endpoint</p>
                          </div>
                          <div class="border-l-2 border-green-400 pl-3 py-1">
                              <p class="text-green-400 font-bold">Hardware</p>
                              <p class="text-slate-400">3 endpoint</p>
                          </div>
                          <div class="border-l-2 border-purple-400 pl-3 py-1">
                              <p class="text-purple-400 font-bold">Reports</p>
                              <p class="text-slate-400">2 endpoint</p>
                          </div>
                          <div class="border-l-2 border-orange-400 pl-3 py-1">
                              <p class="text-orange-400 font-bold">Diger</p>
                              <p class="text-slate-400">+ 10 endpoint</p>
                          </div>
                      </div>
                      <p class="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-700">
                          Toplam: <span class="font-bold text-cyan-400">24 Endpoint</span>
                      </p>
                  </div>

                  <div class="glass p-6 rounded-xl">
                      <h3 class="text-lg font-bold mb-4">Hizli Linkler</h3>
                      <div class="space-y-2">
                          <a href="/" class="block p-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-cyan-400 transition">
                              📊 Status Page
                          </a>
                          <a href="/api/reports/pdf" class="block p-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-cyan-400 transition">
                              📄 PDF Rapor Indir
                          </a>
                          <a href="/api/archive/list" class="block p-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-cyan-400 transition">
                              📁 Arsivi Goster
                          </a>
                      </div>
                  </div>

              </div>

          </div>

          <div class="glass p-4 rounded-xl text-center border-t border-slate-700">
              <p class="text-slate-400 text-sm">
                  ANTARES v2.1 • Modular Backend with Enhanced Status Dashboard
              </p>
              <p class="text-slate-500 text-xs mt-2">
                  Last Updated: ${new Date().toLocaleString("tr-TR")}
              </p>
          </div>

      </div>
  </body>
  </html>`;

  res.send(html);
});

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

// ============= LEGACY SUPPORT (ACİL YAMA) =============
// Bu kısım, Frontend'in ve ESP32'nin eski "/api/data" adresine
// attığı isteklerin 404 dönmemesi için eklenmiştir.
app.get("/api/data", (req, res) => {
  // ESP32 genelde token göndermediği için burada auth kontrolü yapmıyoruz
  res.json({
    ...sensorData,
    newMsg: global.webMessages.length > 0 ? global.webMessages[0] : null,
  });
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
  console.log(`   • /api/reports - PDF Reports`);
  console.log(`   • /api/data - Legacy Support (Fixed)\n`); // Loga da ekledim
  console.log(`📊 Status Page: http://localhost:${PORT}\n`);
});
