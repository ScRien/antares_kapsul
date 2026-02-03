const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

// ============= MIDDLEWARE AYARLARI =============
app.use(cors());

// JSON veriler için parser - Express 4.16+ ile built-in
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// RAW body parser for image uploads from ESP32
app.use(express.raw({ type: ["image/jpeg", "image/png"], limit: "10mb" }));

// Statik dosyalar (Yüklenen resimlere tarayıcıdan bakmak için)
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}
app.use("/uploads", express.static(UPLOAD_DIR));

// ============= GLOBAL DEĞİŞKENLER =============
global.sensorData = {
  t: 0,
  h: 0,
  s: "?",
  ht: 0,
  f1: 0,
  f2: 0,
  timestamp: new Date().toLocaleTimeString("tr-TR"),
  frameTimestamp: null, // ADDED: For stream frame timestamp
};

global.commandQueue = [];
global.webMessages = [];
global.sensorHistory = [];
let commandCounter = 0;

// Live Mode State
const liveMode = {
  active: false,
  duration: 300000, // 5 minutes in ms
  endTime: null,
};

// ============= YARDIMCI FONKSİYONLAR =============
function addCommand(type, value) {
  const cmd = {
    id: ++commandCounter,
    type: type,
    value: value,
    status: "pending",
    timestamp: new Date().toLocaleTimeString("tr-TR"),
  };
  global.commandQueue.push(cmd);
  console.log(`[CMD] Komut eklendi: ${type}=${value} (ID: ${cmd.id})`);
}

// ============= AUTHENTICATION MIDDLEWARE =============
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // For development, accept any token or no token
  // In production, implement proper JWT validation
  if (token || true) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// ============= ESP32 ENDPOINT'LERİ =============

// Pending Commands
app.get("/api/pending-cmd", (req, res) => {
  const pendingCommands = global.commandQueue.filter(
    (c) => c.status === "pending",
  );

  res.json({
    count: pendingCommands.length,
    commands: pendingCommands,
  });
});

// Acknowledge Command
app.post("/api/ack", (req, res) => {
  const { acked_ids } = req.body;

  if (acked_ids && Array.isArray(acked_ids)) {
    acked_ids.forEach((id) => {
      const cmd = global.commandQueue.find((c) => c.id === id);
      if (cmd) {
        cmd.status = "ack";
        console.log(`[ACK] Komut onaylandı ID: ${id}`);
      }
    });
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Invalid format" });
  }
});

// Log Summary / Sensor Data
app.post("/api/log-summary", (req, res) => {
  const data = req.body;

  if (data) {
    global.sensorData = {
      ...global.sensorData,
      ...data,
      timestamp: new Date().toLocaleTimeString("tr-TR"),
    };

    global.sensorHistory.push({
      ...global.sensorData,
      ts: Date.now(),
    });

    if (global.sensorHistory.length > 100) global.sensorHistory.shift();

    console.log(`[LOG] Sensör Verisi: ${data.t}°C / %${data.h} Nem`);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "No data" });
  }
});

// Stream Upload (Binary Image)
app.post("/api/stream-upload", (req, res) => {
  const fileName = req.headers["x-file-name"];

  if (!fileName) {
    return res.status(400).send("X-File-Name header missing");
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).send("No file data received");
  }

  const filePath = path.join(UPLOAD_DIR, fileName);

  fs.writeFile(filePath, req.body, (err) => {
    if (err) {
      console.error("Dosya yazma hatası:", err);
      return res.status(500).send("Save failed");
    }

    // Update frame timestamp
    global.sensorData.frameTimestamp = new Date().toLocaleTimeString("tr-TR");

    console.log(
      `[UPLOAD] Yeni resim kaydedildi: ${fileName} (${req.body.length} bytes)`,
    );
    res.status(200).send("OK");
  });
});

// Data & Messages Check (with ESP32 bug workaround)
const handleDataRequest = (req, res) => {
  const response = {
    ...global.sensorData,
    newMsg: global.webMessages.length > 0 ? global.webMessages[0] : null,
  };

  res.json(response);
};

app.get("/api/data", handleDataRequest);
app.get("/api/api/data", handleDataRequest); // ESP32 bug workaround

// ============= FRONTEND API ENDPOINTS =============

// Command Endpoint (for browser control)
app.get("/api/cmd", (req, res) => {
  const { fan1, fan2, msg, capture, capture_live } = req.query;

  let actionTaken = false;

  if (fan1) {
    addCommand("fan1", fan1);
    actionTaken = true;
  }
  if (fan2) {
    addCommand("fan2", fan2);
    actionTaken = true;
  }
  if (msg) {
    const msgObj = {
      text: msg,
      timestamp: new Date().toLocaleTimeString("tr-TR"),
    };
    global.webMessages.unshift(msgObj);
    addCommand("msg", msg);
    actionTaken = true;
  }
  if (capture === "true" || capture === "1") {
    addCommand("capture", "START");
    actionTaken = true;
  }
  if (capture_live) {
    addCommand("capture_live", capture_live);
    actionTaken = true;
  }

  res.json({
    success: true,
    message: actionTaken
      ? "Komutlar kuyruğa eklendi"
      : "Parametre eksik (fan1, fan2, msg...)",
    queueSize: global.commandQueue.length,
  });
});

// ============= STREAM ENDPOINT (FIXED) =============
app.get("/api/stream", authenticateToken, (req, res) => {
  // Find the most recent image in uploads directory
  try {
    const files = fs
      .readdirSync(UPLOAD_DIR)
      .filter((f) => f.endsWith(".jpg") || f.endsWith(".png"))
      .map((f) => ({
        name: f,
        path: path.join(UPLOAD_DIR, f),
        mtime: fs.statSync(path.join(UPLOAD_DIR, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      // Serve the most recent image
      const imageBuffer = fs.readFileSync(files[0].path);
      const ext = path.extname(files[0].name).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : "image/jpeg";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(imageBuffer);

      console.log(`[STREAM] Serving: ${files[0].name}`);
    } else {
      // No images yet - send placeholder
      const placeholder = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );
      res.setHeader("Content-Type", "image/png");
      res.send(placeholder);

      console.log("[STREAM] No images - serving placeholder");
    }
  } catch (error) {
    console.error("[STREAM] Error:", error);

    // Error fallback - send placeholder
    const placeholder = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    res.setHeader("Content-Type", "image/png");
    res.send(placeholder);
  }
});

// ============= LIVE MODE ENDPOINTS =============

// Live Mode Start
app.post("/api/live-mode-start", authenticateToken, (req, res) => {
  if (liveMode.active) {
    return res.json({
      success: false,
      message: "Canli mod zaten aktif",
    });
  }

  liveMode.active = true;
  liveMode.endTime = Date.now() + liveMode.duration;

  // Auto stop after duration
  setTimeout(() => {
    liveMode.active = false;
    liveMode.endTime = null;
    console.log("[LIVE] Otomatik durduruldu");
  }, liveMode.duration);

  console.log("[LIVE] Başlatıldı - 5 dakika");

  res.json({
    success: true,
    message: "Canli mod baslatildi (5 dakika)",
    queueStats: {
      total: global.commandQueue.length,
      pending: global.commandQueue.filter((c) => c.status === "pending").length,
      sent: global.commandQueue.filter((c) => c.status === "sent").length,
      acked: global.commandQueue.filter((c) => c.status === "ack").length,
    },
  });
});

// Live Mode Stop
app.post("/api/live-mode-stop", authenticateToken, (req, res) => {
  liveMode.active = false;
  liveMode.endTime = null;

  console.log("[LIVE] Manuel durduruldu");

  res.json({
    success: true,
    message: "Canli mod durduruldu",
  });
});

// Live Mode Status
app.get("/api/live-mode-status", authenticateToken, (req, res) => {
  res.json({
    active: liveMode.active,
    endTime: liveMode.endTime,
    queueStats: {
      total: global.commandQueue.length,
      pending: global.commandQueue.filter((c) => c.status === "pending").length,
      sent: global.commandQueue.filter((c) => c.status === "sent").length,
      acked: global.commandQueue.filter((c) => c.status === "ack").length,
    },
  });
});

// ============= DASHBOARD (HTML) =============
app.get("/", (req, res) => {
  let lastImgHtml = "<p>Henüz resim yok</p>";

  try {
    const files = fs
      .readdirSync(UPLOAD_DIR)
      .filter((f) => f.endsWith(".jpg") || f.endsWith(".png"))
      .sort((a, b) => {
        return (
          fs.statSync(path.join(UPLOAD_DIR, b)).mtime.getTime() -
          fs.statSync(path.join(UPLOAD_DIR, a)).mtime.getTime()
        );
      });

    if (files.length > 0) {
      lastImgHtml = `
        <div class="glass p-4 rounded-xl mt-4">
          <h3 class="text-lg font-bold mb-2">Son Çekilen Fotoğraf</h3>
          <p class="text-xs text-slate-400 mb-2">${files[0]}</p>
          <img src="/uploads/${files[0]}" class="rounded-lg border border-slate-600 w-full max-w-md mx-auto" />
        </div>
      `;
    }
  } catch (e) {
    console.log("Dosya okuma hatası", e);
  }

  const html = `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
      <meta charset="UTF-8">
      <title>ANTARES v3 | Backend</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { background: #0f172a; color: #f8fafc; font-family: sans-serif; }
        .glass { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); }
      </style>
  </head>
  <body class="p-6">
      <div class="max-w-4xl mx-auto">
          <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold text-cyan-400">ANTARES v3.0 Backend</h1>
            <span class="bg-green-900 text-green-300 px-3 py-1 rounded-full text-sm">Sistem Aktif</span>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div class="glass p-4 rounded-xl text-center">
                  <div class="text-slate-400 text-xs">SICAKLIK</div>
                  <div class="text-3xl font-bold text-orange-400">${global.sensorData.t}°C</div>
              </div>
              <div class="glass p-4 rounded-xl text-center">
                  <div class="text-slate-400 text-xs">NEM</div>
                  <div class="text-3xl font-bold text-blue-400">%${global.sensorData.h}</div>
              </div>
               <div class="glass p-4 rounded-xl text-center">
                  <div class="text-slate-400 text-xs">TOPRAK</div>
                  <div class="text-3xl font-bold text-amber-400">${global.sensorData.s}</div>
              </div>
              <div class="glass p-4 rounded-xl text-center">
                  <div class="text-slate-400 text-xs">BEKLEYEN KOMUT</div>
                  <div class="text-3xl font-bold text-purple-400">${global.commandQueue.filter((c) => c.status === "pending").length}</div>
              </div>
          </div>

          <div class="glass p-6 rounded-xl mb-8">
              <h2 class="text-xl font-bold mb-4">Hızlı Kontrol Paneli</h2>
              <div class="flex gap-4 flex-wrap">
                  <a href="/api/cmd?fan1=ON" target="_blank" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white text-sm">Fan 1 AÇ</a>
                  <a href="/api/cmd?fan1=OFF" target="_blank" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white text-sm">Fan 1 KAPAT</a>
                  <div class="w-px bg-slate-600 mx-2"></div>
                  <a href="/api/cmd?fan2=ON" target="_blank" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white text-sm">Fan 2 AÇ</a>
                  <a href="/api/cmd?fan2=OFF" target="_blank" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white text-sm">Fan 2 KAPAT</a>
                  <div class="w-px bg-slate-600 mx-2"></div>
                  <a href="/api/cmd?msg=Test Mesaji" target="_blank" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white text-sm">Mesaj Gönder</a>
                  <a href="/api/cmd?capture_live=MANUAL_LIVE_FRAME" target="_blank" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white text-sm">📸 Foto Çek</a>
              </div>
          </div>

          ${lastImgHtml}

          <div class="text-center text-xs text-slate-500 mt-12">
            Son Güncelleme: ${new Date().toLocaleString("tr-TR")} <br>
            Stream Endpoint: ✅ AKTİF | Live Mode: ${liveMode.active ? "🔴 CANLI" : "⚪ KAPALI"}
          </div>
      </div>
  </body>
  </html>
  `;
  res.send(html);
});

// ============= SUNUCUYU BAŞLAT =============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ ANTARES Backend Başlatıldı`);
  console.log(`📍 Adres: http://localhost:${PORT}`);
  console.log(`🛠️  Stream Endpoint: /api/stream - AKTİF`);
  console.log(`🛠️  Live Mode: /api/live-mode-* - AKTİF`);
  console.log(`📂 Upload Klasörü: ${UPLOAD_DIR}\n`);
});
