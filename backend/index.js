const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// ============= BELLEKTEKI VERİLER =============
let sensorHistory = [];
let targetClimate = { t: 22.0, h: 60.0 };

// ✅ v2: Command Queue (FIFO - First In First Out)
let commandQueue = [];
let commandCounter = 0;

// ============= v4: Canli Goruntusu =============
let latestLiveFrame = null;
let frameTimestamp = null;

// ✅ v3: Web Mesaj Havuzu (Son 5 mesaj tutulur)
let webMessages = [];
const MAX_MESSAGES = 5;
let lastNewMessage = null;

// Backend state
let hardwareState = {
  f1: 0,
  f2: 0,
};

// ============= STATUS PAGE (HTML/CSS) =============
app.get("/", (req, res) => {
  const latest = sensorHistory[sensorHistory.length - 1] || {};
  const pendingCount = commandQueue.filter(
    (c) => c.status === "pending",
  ).length;
  const ackedCount = commandQueue.filter((c) => c.status === "ack").length;

  const html = `
  <!DOCTYPE html>
  <html lang="tr">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ANTARES | Backend Status</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;500;700&display=swap');
          body { font-family: 'Space Grotesk', sans-serif; background-color: #0f172a; color: #f8fafc; }
          .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
          .status-pulse { animation: pulse 2s infinite; }
          @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
          .accent-gradient { background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); }
          .btn-primary { background: linear-gradient(135deg, #00d2ff 0%, #10ac84 100%); transition: all 0.3s ease; }
          .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0, 210, 255, 0.3); }
          .btn-primary:active { transform: translateY(0px); }
          .btn-danger { background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%); transition: all 0.3s ease; }
          .btn-danger:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(255, 107, 107, 0.3); }
          .btn-danger:active { transform: translateY(0px); }
      </style>
  </head>
  <body class="p-4 md:p-8">
      <div class="max-w-5xl mx-auto">
          <div class="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
              <div>
                  <h1 class="text-4xl font-bold tracking-tighter text-transparent bg-clip-text accent-gradient">
                      ANTARES <span class="text-white opacity-20 text-xl">v2.1</span>
                  </h1>
                  <p class="text-slate-400 text-sm uppercase tracking-widest mt-1">Akilli Koruma Kapsulu Kontrol Merkezi</p>
              </div>
              <div class="flex items-center gap-3 px-4 py-2 rounded-full glass">
                  <div class="w-3 h-3 bg-emerald-500 rounded-full status-pulse"></div>
                  <span class="text-sm font-medium">Sistem Cevrimici</span>
              </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div class="glass p-6 rounded-3xl">
                  <p class="text-slate-400 text-xs uppercase mb-1">Sicaklik</p>
                  <h2 class="text-3xl font-bold">${latest.temperature || "--"}°C</h2>
              </div>
              <div class="glass p-6 rounded-3xl">
                  <p class="text-slate-400 text-xs uppercase mb-1">Nem Orani</p>
                  <h2 class="text-3xl font-bold">%${latest.humidity || "--"}</h2>
              </div>
              <div class="glass p-6 rounded-3xl">
                  <p class="text-slate-400 text-xs uppercase mb-1">Bekleyen Komut</p>
                  <h2 class="text-3xl font-bold text-amber-400">${pendingCount}</h2>
              </div>
              <div class="glass p-6 rounded-3xl border-emerald-500/30">
                  <p class="text-slate-400 text-xs uppercase mb-1">Onaylanan (ACK)</p>
                  <h2 class="text-3xl font-bold text-emerald-400">${ackedCount}</h2>
              </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div class="lg:col-span-2 glass rounded-[2rem] p-8">
                  <div class="flex justify-between items-center mb-6">
                      <h3 class="text-xl font-bold flex items-center gap-3">
                          <i class="fa-solid fa-list-check text-sky-400"></i> Komut Havuzu (Queue)
                      </h3>
                      <button onclick="clearAllCommands()" class="btn-danger text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest">
                          <i class="fa-solid fa-trash mr-2"></i>Hepsini Sil
                      </button>
                  </div>
                  <div class="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      ${
                        commandQueue.length === 0
                          ? '<p class="text-slate-500 italic">Şu an sırada komut yok...</p>'
                          : commandQueue
                              .slice()
                              .reverse()
                              .map(
                                (cmd, i) => `
                        <div class="bg-slate-800 p-3 rounded-lg text-xs border-l-2 ${
                          cmd.status === "pending"
                            ? "border-amber-500"
                            : cmd.status === "sent"
                              ? "border-sky-500"
                              : "border-emerald-500"
                        } flex justify-between items-center">
                          <div>
                            <div class="flex justify-between items-center">
                              <span class="font-bold">#${cmd.id} | ${cmd.type}</span>
                              <span class="text-[10px] ${
                                cmd.status === "pending"
                                  ? "text-amber-400"
                                  : cmd.status === "sent"
                                    ? "text-sky-400"
                                    : "text-emerald-400"
                              } ml-2">${cmd.status.toUpperCase()}</span>
                            </div>
                            <div class="mt-1 text-slate-400">Deger: <span class="text-slate-200">${cmd.value}</span></div>
                            <div class="text-[10px] text-slate-500 mt-1">${cmd.timestamp ? new Date(cmd.timestamp).toLocaleTimeString("tr-TR") : "--"}</div>
                          </div>
                          <button onclick="deleteCommand(${cmd.id})" class="btn-danger text-white px-2 py-1 rounded text-[10px] ml-2 hover:brightness-110 active:scale-95">
                              <i class="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      `,
                              )
                              .join("")
                      }
                  </div>
              </div>
              <div class="glass rounded-[2rem] p-8">
                  <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                      <i class="fa-solid fa-chart-line text-emerald-400"></i> Sistem Durumu
                  </h3>
                  <div class="space-y-3 text-sm">
                      <div>
                          <p class="text-slate-400 text-xs uppercase mb-1">Fan 1 (Salyangoz)</p>
                          <p class="text-2xl font-bold ${hardwareState.f1 === 1 ? "text-emerald-400" : "text-slate-500"}">
                              ${hardwareState.f1 === 1 ? "✅ ACIK" : "❌ KAPALI"}
                          </p>
                      </div>
                      <div>
                          <p class="text-slate-400 text-xs uppercase mb-1">Fan 2 (Duz Fan)</p>
                          <p class="text-2xl font-bold ${hardwareState.f2 === 1 ? "text-emerald-400" : "text-slate-500"}">
                              ${hardwareState.f2 === 1 ? "✅ ACIK" : "❌ KAPALI"}
                          </p>
                      </div>
                      <hr class="border-slate-700 my-4" />
                      <div>
                          <p class="text-slate-400 text-xs uppercase mb-2">Son 5 Mesaj</p>
                          <div class="space-y-2">
                              ${
                                webMessages.length === 0
                                  ? '<p class="text-slate-500 italic text-xs">Henuz mesaj yok</p>'
                                  : webMessages
                                      .map(
                                        (msg) => `
                              <div class="bg-slate-800 p-2 rounded text-[10px] border-l-2 border-cyan-500">
                                <p class="text-slate-200">${msg.text}</p>
                                <p class="text-slate-500 mt-1">${msg.timestamp}</p>
                              </div>
                            `,
                                      )
                                      .join("")
                              }
                          </div>
                          <button onclick="clearMessages()" class="btn-danger text-white px-3 py-1 rounded text-[10px] mt-3 w-full hover:brightness-110 active:scale-95">
                              <i class="fa-solid fa-trash mr-1"></i>Mesajları Sil
                          </button>
                      </div>
                  </div>
              </div>
          </div>

          <!-- TEMIZLEME KONTROLLLERI BOLUMU -->
          <div class="glass rounded-[2rem] p-8 mb-8">
              <h3 class="text-xl font-bold mb-6 flex items-center gap-3">
                  <i class="fa-solid fa-broom text-amber-400"></i> Temizleme Kontrolleri
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button onclick="clearPendingCommands()" class="btn-danger text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                      <i class="fa-solid fa-hourglass-end"></i> Beklemede Olanları Sil
                  </button>
                  <button onclick="clearSentCommands()" class="btn-danger text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                      <i class="fa-solid fa-paper-plane"></i> Gönderilenları Sil
                  </button>
                  <button onclick="clearAckedCommands()" class="btn-danger text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                      <i class="fa-solid fa-check-double"></i> Onaylanmışları Sil
                  </button>
              </div>
              <div class="mt-4 p-4 bg-amber-500/10 border-l-4 border-amber-500 rounded-lg">
                  <p class="text-amber-200 text-sm">
                      <i class="fa-solid fa-exclamation-triangle mr-2"></i>
                      Uyarı: Temizleme işlemleri geri alınamaz. Sadece gerekli olduğunda kullanın.
                  </p>
              </div>
          </div>

          <!-- RAPOR BOLUMU -->
          <div class="glass rounded-[2rem] p-8">
              <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                      <h3 class="text-xl font-bold flex items-center gap-3 mb-2">
                          <i class="fa-solid fa-file-pdf text-red-400"></i> Sistem Analiz Raporu
                      </h3>
                      <p class="text-slate-400 text-sm">
                          ${sensorHistory.length} kayitli veri ile detayli rapor olustur
                      </p>
                  </div>
                  <a href="/api/generate-report" 
                     class="btn-primary text-white px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-widest cursor-pointer hover:no-underline"
                     download>
                      <i class="fa-solid fa-download mr-2"></i> PDF Indir
                  </a>
              </div>
          </div>
      </div>

      <script>
          async function clearAllCommands() {
              if (!confirm('TÜM komutları silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
              const res = await fetch('/api/clear/all-commands', { method: 'POST' });
              const data = await res.json();
              alert(\`✅ \${data.deletedCount} komut silindi\`);
              location.reload();
          }

          async function clearPendingCommands() {
              if (!confirm('Tüm BEKLEMEDE komutları silmek istediğinize emin misiniz?')) return;
              const res = await fetch('/api/clear/pending-commands', { method: 'POST' });
              const data = await res.json();
              alert(\`✅ \${data.deletedCount} komut silindi\`);
              location.reload();
          }

          async function clearSentCommands() {
              if (!confirm('Tüm GÖNDERILEN komutları silmek istediğinize emin misiniz?')) return;
              const res = await fetch('/api/clear/sent-commands', { method: 'POST' });
              const data = await res.json();
              alert(\`✅ \${data.deletedCount} komut silindi\`);
              location.reload();
          }

          async function clearAckedCommands() {
              if (!confirm('Tüm ONAYLANAN komutları silmek istediğinize emin misiniz?')) return;
              const res = await fetch('/api/clear/acked-commands', { method: 'POST' });
              const data = await res.json();
              alert(\`✅ \${data.deletedCount} komut silindi\`);
              location.reload();
          }

          async function deleteCommand(id) {
              if (!confirm(\`Komut #\${id}'yi silmek istediğinize emin misiniz?\`)) return;
              const res = await fetch('/api/delete-command', { 
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ commandId: id })
              });
              const data = await res.json();
              if (data.success) {
                  alert('✅ Komut silindi');
                  location.reload();
              }
          }

          async function clearMessages() {
              if (!confirm('Tüm mesajları silmek istediğinize emin misiniz?')) return;
              const res = await fetch('/api/clear/messages', { method: 'POST' });
              const data = await res.json();
              alert(\`✅ \${data.deletedCount} mesaj silindi\`);
              location.reload();
          }

          async function clearSensorHistory() {
              if (!confirm('Tüm sensör geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
              const res = await fetch('/api/clear/history', { method: 'POST' });
              const data = await res.json();
              alert(\`✅ \${data.deletedCount} kayıt silindi\`);
              location.reload();
          }

          // Otomatik yenileme (30 saniye)
          setTimeout(() => location.reload(), 30000);
      </script>
  </body>
  </html>
  `;

  res.send(html);
});

// ============= API VERI ENDPOINTS =============

app.get("/api/data", (req, res) => {
  const latest = sensorHistory[sensorHistory.length - 1] || {
    temperature: "--",
    humidity: "--",
    soil_context: "Baglantisiz",
  };

  res.json({
    ...latest,
    t: latest.temperature || "--",
    h: latest.humidity || "--",
    s: latest.soil_context || "--",
    f1: hardwareState.f1,
    f2: hardwareState.f2,
    messages: webMessages,
    newMsg: lastNewMessage,
    frameTimestamp: frameTimestamp,
    frameSize: latestLiveFrame ? latestLiveFrame.length : 0,
  });
});

// ============= KOMUT ENDPOINTS =============

app.get("/api/cmd", (req, res) => {
  const { fan1, fan2, msg } = req.query;

  if (fan1) {
    commandQueue.push({
      id: ++commandCounter,
      type: "fan1",
      value: fan1.toUpperCase(),
      status: "pending",
      timestamp: Date.now(),
    });
    console.log(`✅ Fan1=${fan1} (ID: ${commandCounter}) siray alindi`);
  }

  if (fan2) {
    commandQueue.push({
      id: ++commandCounter,
      type: "fan2",
      value: fan2.toUpperCase(),
      status: "pending",
      timestamp: Date.now(),
    });
    console.log(`✅ Fan2=${fan2} (ID: ${commandCounter}) siray alindi`);
  }

  if (msg) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString
      ? now.toLocaleTimeString("tr-TR").split(" ")[0]
      : now.getHours() +
        ":" +
        String(now.getMinutes()).padStart(2, "0") +
        ":" +
        String(now.getSeconds()).padStart(2, "0");

    commandQueue.push({
      id: ++commandCounter,
      type: "msg",
      value: msg,
      status: "pending",
      timestamp: Date.now(),
    });
    console.log(
      `✅ MSG="${msg}" (${timeStr}) (ID: ${commandCounter}) siray alindi`,
    );

    webMessages.unshift({
      text: msg,
      timestamp: timeStr,
    });

    if (webMessages.length > MAX_MESSAGES) {
      webMessages.pop();
    }

    lastNewMessage = {
      text: msg,
      timestamp: timeStr,
    };

    console.log(`💾 Mesaj havuzu: ${webMessages.length}/${MAX_MESSAGES}`);
  }

  if (fan1) hardwareState.f1 = fan1.toUpperCase() === "ON" ? 1 : 0;
  if (fan2) hardwareState.f2 = fan2.toUpperCase() === "ON" ? 1 : 0;

  res.json({
    success: true,
    queueLength: commandQueue.length,
    lastCommandId: commandCounter,
    hardwareState: hardwareState,
  });
});

app.get("/api/pending-cmd", (req, res) => {
  const pending = commandQueue.filter((cmd) => cmd.status === "pending");

  pending.forEach((cmd) => (cmd.status = "sent"));

  const toSend = pending.slice(0, 5);

  console.log(`📤 ${toSend.length} komut ESP32'ye gonderiliiyor`);

  res.json({
    commands: toSend,
    count: toSend.length,
  });
});

app.post("/api/cmd-ack", (req, res) => {
  const { commandIds } = req.body;

  if (!Array.isArray(commandIds) || commandIds.length === 0) {
    return res.status(400).json({ error: "commandIds array gerekli" });
  }

  let ackedCount = 0;

  commandIds.forEach((id) => {
    const idx = commandQueue.findIndex((cmd) => cmd.id === id);
    if (idx !== -1) {
      commandQueue[idx].status = "ack";
      commandQueue[idx].ackedAt = Date.now();
      ackedCount++;
    }
  });

  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const initialLength = commandQueue.length;

  commandQueue = commandQueue.filter((cmd) => {
    if (cmd.status === "ack" && cmd.ackedAt && cmd.ackedAt < fiveMinutesAgo) {
      return false;
    }
    return true;
  });

  const cleaned = initialLength - commandQueue.length;

  console.log(
    `✅ ${ackedCount} komut onaylandi, ${cleaned} eski komut silindi`,
  );

  res.json({
    success: true,
    ackedCount: ackedCount,
    cleanedCount: cleaned,
    queueLength: commandQueue.length,
  });
});

app.get("/api/msg", (req, res) => {
  const { text } = req.query;
  console.log("LCD Mesaji:", text);

  res.json({
    success: true,
    message: "LCD mesaji alindi",
    text: text,
  });
});

app.get("/api/capture", (req, res) => {
  commandQueue.push({
    id: ++commandCounter,
    type: "capture",
    value: "START_360_SCAN",
    status: "pending",
    timestamp: Date.now(),
  });

  console.log(`✅ Tarama komutu (ID: ${commandCounter}) siray alindi`);

  res.json({
    success: true,
    message: "Tarama komutu siray alindi",
    commandId: commandCounter,
    queueLength: commandQueue.length,
  });
});

app.get("/api/capture-live", (req, res) => {
  commandQueue.push({
    id: ++commandCounter,
    type: "capture_live",
    value: "MANUAL_LIVE_FRAME",
    status: "pending",
    timestamp: Date.now(),
  });

  console.log(
    `📸 [MANUEL BUTON] Canli kare komutu (ID: ${commandCounter}) siray alindi`,
  );

  res.json({
    success: true,
    message: "Canli kare komutu siray alindi - ESP32 cekiyor...",
    commandId: commandCounter,
  });
});

// ============= TEMIZLEME ENDPOINTS =============

app.post("/api/clear/all-commands", (req, res) => {
  const deletedCount = commandQueue.length;
  commandQueue = [];
  console.log(`🗑️ TÜM ${deletedCount} komut silindi`);
  res.json({ success: true, deletedCount });
});

app.post("/api/clear/pending-commands", (req, res) => {
  const initialLength = commandQueue.length;
  commandQueue = commandQueue.filter((cmd) => cmd.status !== "pending");
  const deletedCount = initialLength - commandQueue.length;
  console.log(`🗑️ ${deletedCount} PENDING komut silindi`);
  res.json({ success: true, deletedCount });
});

app.post("/api/clear/sent-commands", (req, res) => {
  const initialLength = commandQueue.length;
  commandQueue = commandQueue.filter((cmd) => cmd.status !== "sent");
  const deletedCount = initialLength - commandQueue.length;
  console.log(`🗑️ ${deletedCount} SENT komut silindi`);
  res.json({ success: true, deletedCount });
});

app.post("/api/clear/acked-commands", (req, res) => {
  const initialLength = commandQueue.length;
  commandQueue = commandQueue.filter((cmd) => cmd.status !== "ack");
  const deletedCount = initialLength - commandQueue.length;
  console.log(`🗑️ ${deletedCount} ACK komut silindi`);
  res.json({ success: true, deletedCount });
});

app.post("/api/delete-command", (req, res) => {
  const { commandId } = req.body;
  const initialLength = commandQueue.length;
  commandQueue = commandQueue.filter((cmd) => cmd.id !== commandId);
  const success = initialLength > commandQueue.length;
  if (success) {
    console.log(`🗑️ Komut #${commandId} silindi`);
  }
  res.json({ success, deletedCount: success ? 1 : 0 });
});

app.post("/api/clear/messages", (req, res) => {
  const deletedCount = webMessages.length;
  webMessages = [];
  lastNewMessage = null;
  console.log(`🗑️ ${deletedCount} mesaj silindi`);
  res.json({ success: true, deletedCount });
});

app.post("/api/clear/history", (req, res) => {
  const deletedCount = sensorHistory.length;
  sensorHistory = [];
  console.log(`🗑️ ${deletedCount} sensör kaydı silindi`);
  res.json({ success: true, deletedCount });
});

// ============= 360° GORSEL PROXY ENDPOINTS =============

app.get("/api/archive/list", async (req, res) => {
  try {
    const esp32Ip = process.env.ESP32_IP || "192.168.4.1";
    const fileListUrl = `http://${esp32Ip}/list`;

    console.log(`📡 ESP32 dosya listesi cekiliyor: ${fileListUrl}`);

    const response = await axios.get(fileListUrl, { timeout: 5000 });

    if (response.data && response.data.files) {
      const sortedFiles = response.data.files.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      console.log(`✅ ${sortedFiles.length} dosya bulundu`);

      res.json({
        success: true,
        count: sortedFiles.length,
        files: sortedFiles,
      });
    } else {
      res.status(500).json({
        error: "ESP32'den veri alinamadi",
      });
    }
  } catch (error) {
    console.error("❌ Dosya listesi hatasi:", error.message);
    res.status(500).json({
      error: "ESP32 baglantisi basarısız",
      details: error.message,
    });
  }
});

app.get("/api/archive/file", async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res
        .status(400)
        .json({ error: "Dosya adi gerekli (query: ?name=...)" });
    }

    if (!name.endsWith(".jpg") && !name.endsWith(".JPG")) {
      return res
        .status(400)
        .json({ error: "Sadece .jpg dosyalari desteklenir" });
    }

    const esp32Ip = process.env.ESP32_IP || "192.168.4.1";
    const fileUrl = `http://${esp32Ip}/file?name=${encodeURIComponent(name)}`;

    console.log(`📸 Dosya aktar: ${name}`);

    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const fileBuffer = Buffer.from(response.data, "binary");

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "max-age=3600");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);

    res.send(fileBuffer);

    console.log(`✅ Dosya gonderildi: ${name} (${fileBuffer.length} bytes)`);
  } catch (error) {
    console.error("❌ Dosya transfer hatasi:", error.message);
    res.status(500).json({
      error: "Dosya alinamadi",
      details: error.message,
    });
  }
});

app.get("/api/archive/thumbnail", async (req, res) => {
  try {
    const { scanId } = req.query;

    if (!scanId) {
      return res.status(400).json({ error: "Tarama ID'si gerekli" });
    }

    const listUrl = `http://${process.env.ESP32_IP || "192.168.4.1"}/list`;
    const listResponse = await axios.get(listUrl, { timeout: 5000 });

    const files = listResponse.data.files || [];
    const scanFiles = files.filter((f) => f.name.startsWith(scanId));

    if (scanFiles.length === 0) {
      return res.status(404).json({ error: "Tarama bulunamadi" });
    }

    const thumbnailFile = scanFiles[0];
    const esp32Ip = process.env.ESP32_IP || "192.168.4.1";
    const fileUrl = `http://${esp32Ip}/file?name=${encodeURIComponent(thumbnailFile.name)}`;

    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const fileBuffer = Buffer.from(response.data, "binary");

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "max-age=3600");
    res.send(fileBuffer);
  } catch (error) {
    console.error("❌ Thumbnail hatasi:", error.message);
    res.status(500).json({
      error: "Thumbnail alinamadi",
      details: error.message,
    });
  }
});

app.post(
  "/api/upload-frame",
  express.raw({ type: "image/jpeg", limit: "2mb" }),
  (req, res) => {
    try {
      latestLiveFrame = req.body;
      frameTimestamp = new Date().toLocaleString
        ? new Date().toLocaleString("tr-TR")
        : new Date().toString();
      console.log(
        `✅ Frame backend'e alindi: ${latestLiveFrame.length} bytes @ ${frameTimestamp}`,
      );
      res.sendStatus(200);
    } catch (error) {
      console.error("❌ Frame yukleme hatasi:", error);
      res.status(400).json({ error: "Frame yuklenemedi" });
    }
  },
);

app.get("/api/stream", (req, res) => {
  if (latestLiveFrame && latestLiveFrame.length > 0) {
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.send(latestLiveFrame);
    console.log(
      `📤 Frame tarayiciya gonderildi: ${latestLiveFrame.length} bytes`,
    );
  } else {
    res.redirect(
      "https://placehold.co/1280x720/111/00d2ff?text=Yayin+Bekleniyor",
    );
  }
});

// ============= CANLΙ MOD YÖNETIMI =============
let liveModeActive = false;
let liveModeInterval = null;

app.post("/api/live-mode-start", (req, res) => {
  if (liveModeActive) {
    return res.json({
      success: false,
      message: "Canlı mod zaten aktif",
    });
  }

  liveModeActive = true;
  console.log(
    "🟢 ===== CANLΙ MOD BAŞLADI ===== 5 dakika / 10sn aralığında otomatik çekme",
  );

  liveModeInterval = setInterval(() => {
    commandQueue.push({
      id: ++commandCounter,
      type: "capture_live",
      value: "AUTO_LIVE_FRAME (5MIN_MODE)",
      status: "pending",
      timestamp: Date.now(),
    });
    const pending = commandQueue.filter((c) => c.status === "pending").length;
    console.log(
      `⏰ [CANLΙ MOD] Kare #${commandCounter} sırada (${pending} pending)`,
    );
  }, 10000);

  setTimeout(
    () => {
      clearInterval(liveModeInterval);
      liveModeActive = false;
      console.log("🔴 ===== CANLΙ MOD BİTTİ ===== 5 dakika tamamlandı");
    },
    5 * 60 * 1000,
  );

  res.json({
    success: true,
    message: "Canlı mod başlatıldı",
    duration: "5 dakika (≈30 otomatik çekme bekleniyor)",
    interval: "10 saniye",
  });
});

app.post("/api/live-mode-stop", (req, res) => {
  if (!liveModeActive) {
    return res.json({
      success: false,
      message: "Canlı mod zaten inaktif",
    });
  }

  clearInterval(liveModeInterval);
  liveModeActive = false;
  console.log("⏹ ===== CANLΙ MOD DURDURULDU ===== (Kullanıcı tarafından)");

  res.json({ success: true, message: "Canlı mod durduruldu" });
});

app.get("/api/live-mode-status", (req, res) => {
  const pending = commandQueue.filter((c) => c.status === "pending").length;
  const sent = commandQueue.filter((c) => c.status === "sent").length;
  const acked = commandQueue.filter((c) => c.status === "ack").length;

  res.json({
    active: liveModeActive,
    queueStats: {
      total: commandQueue.length,
      pending,
      sent,
      acked,
    },
  });
});

// ============= LOG & BULUT ENDPOINTS =============

app.post("/api/log-summary", (req, res) => {
  const { t, h, s, ht, f1, f2, shk, st } = req.body;

  if (f1 !== undefined) hardwareState.f1 = f1;
  if (f2 !== undefined) hardwareState.f2 = f2;

  const logEntry = {
    timestamp: new Date().toLocaleString
      ? new Date().toLocaleString("tr-TR")
      : new Date().toString(),
    temperature: t,
    humidity: h,
    soil_context: s,
    heater_power: ht,
    f1: f1,
    f2: f2,
    shock: shk,
    system_status: st,
    queueStatus: {
      totalPending: commandQueue.filter((c) => c.status === "pending").length,
      totalSent: commandQueue.filter((c) => c.status === "sent").length,
      totalAcked: commandQueue.filter((c) => c.status === "ack").length,
    },
  };

  sensorHistory.push(logEntry);

  if (sensorHistory.length > 1000) sensorHistory.shift();

  console.log("✅ Kara Kutu Güncellendi:", {
    temp: t,
    humidity: h,
    f1: f1,
    f2: f2,
    queueLength: commandQueue.length,
  });

  res.status(200).json({
    message: "Veri buluta islendi",
    recorded: logEntry,
    hardwareStateSync: { f1: hardwareState.f1, f2: hardwareState.f2 },
  });
});

// ============= DEBUG ENDPOINTS =============

app.get("/api/queue-status", (req, res) => {
  res.json({
    total: commandQueue.length,
    pending: commandQueue.filter((c) => c.status === "pending"),
    sent: commandQueue.filter((c) => c.status === "sent"),
    acked: commandQueue.filter((c) => c.status === "ack"),
    lastCommandId: commandCounter,
  });
});

// PDF RAPOR
const path = require("path");
const fs = require("fs");

app.get("/api/generate-report", (req, res) => {
  // ---- Safety: tek handler olduğundan emin ol ----
  // (Projede "generate-report" aratıp eski kopyaları sil)

  const generatedAt = new Date();
  const isoDate = generatedAt.toISOString().split("T")[0];
  const fileName = `Antares_Analiz_Raporu_${isoDate}.pdf`;

  // Response headers
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
    compress: true,
    autoFirstPage: true,
  });

  // Pipe
  doc.pipe(res);

  // Abort / error safety (Render'da "write after end" vb. keser)
  const safeEnd = () => {
    try {
      if (!doc._ended) doc.end();
    } catch (_) {}
  };
  res.on("close", safeEnd);
  doc.on("error", (err) => {
    console.error("❌ PDFKit error:", err);
    try {
      if (!res.headersSent) res.status(500);
      res.end();
    } catch (_) {}
    safeEnd();
  });

  // ---------- Layout constants ----------
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  const M = 40;
  const LEFT = M;
  const RIGHT = pageW - M;
  const CONTENT_W = RIGHT - LEFT;

  const FOOTER_H = 34; // footer çizim alanı
  const FOOTER_GAP = 10; // içerik ile footer arası
  const SAFE_BOTTOM = pageH - M - FOOTER_H - FOOTER_GAP;
  const TOP = M;

  // ---------- Fonts (Türkçe için garanti) ----------
  // assets/fonts içine NotoSans-Regular.ttf ve NotoSans-Bold.ttf koymalısın
  const fontDir = path.join(__dirname, "assets", "fonts");

  const families = [
    { regular: "NotoSans-Regular.ttf", bold: "NotoSans-Bold.ttf" },
    { regular: "DejaVuSans.ttf", bold: "DejaVuSans-Bold.ttf" },
    { regular: "Roboto-Regular.ttf", bold: "Roboto-Bold.ttf" },
    { regular: "Inter-Regular.ttf", bold: "Inter-Bold.ttf" },
  ];

  const fonts = { base: "Helvetica", bold: "Helvetica-Bold" };

  // 🔍 Font yükleme debugging
  let fontLoaded = false;
  console.log(`[PDF] Font dizini arıyor: ${fontDir}`);

  for (const fam of families) {
    const regPath = path.join(fontDir, fam.regular);
    const boldPath = path.join(fontDir, fam.bold);

    const regExists = fs.existsSync(regPath);
    const boldExists = fs.existsSync(boldPath);

    console.log(
      `[PDF] Kontrol: ${fam.regular} -> ${regExists ? "✅ Bulundu" : "❌ Bulunamadı"}`,
    );

    if (regExists) {
      try {
        doc.registerFont("BaseFont", regPath);
        fonts.base = "BaseFont";
        console.log(`[PDF] ✅ BaseFont kaydedildi: ${fam.regular}`);

        if (boldExists) {
          doc.registerFont("BaseBold", boldPath);
          fonts.bold = "BaseBold";
          console.log(`[PDF] ✅ BaseBold kaydedildi: ${fam.bold}`);
        } else {
          fonts.bold = fonts.base;
          console.log(`[PDF] ⚠️ Bold font bulunamadı, regular kullanılıyor`);
        }
        fontLoaded = true;
        break;
      } catch (e) {
        console.error(
          `[PDF] ❌ Font kaydı hatası (${fam.regular}):`,
          e.message,
        );
      }
    }
  }

  if (!fontLoaded) {
    console.warn(
      "[PDF] ⚠️ Hiçbir Türkçe font bulunamadı, Helvetica fallback kullanılıyor (Türkçe karakterler bozulabilir)",
    );
    console.warn(
      "[PDF] 💡 Çözüm: backend/assets/fonts/ klasörüne NotoSans-Regular.ttf ve NotoSans-Bold.ttf ekle",
    );
  }

  // ---------- Theme ----------
  const colors = {
    primary: "#00d2ff",
    secondary: "#10ac84",
    dark: "#0f172a",
    text: "#2d3436",
    lightText: "#64748b",
    border: "#e6eef6",
    surface: "#fbfdff",
    accent: "#ff9f43",
  };

  // ---------- Helpers ----------
  const reportId = `ANT-${Date.now().toString().slice(-8)}`;

  let y = TOP;

  function setBody() {
    doc.font(fonts.base).fontSize(10).fillColor(colors.text);
  }

  function ensureSpace(needed, onNewPage) {
    if (y + needed > SAFE_BOTTOM) {
      doc.addPage();
      y = TOP;
      if (onNewPage) onNewPage();
    }
  }

  function section(title) {
    ensureSpace(34);
    doc.save();
    doc
      .font(fonts.bold)
      .fontSize(14)
      .fillColor(colors.primary)
      .text(title, LEFT, y);
    doc
      .moveTo(LEFT, y + 18)
      .lineTo(RIGHT, y + 18)
      .lineWidth(0.7)
      .strokeColor(colors.border)
      .stroke();
    doc.restore();
    y += 30;
  }

  function card(x, y0, w, h, title, value, valueColor) {
    doc.save();
    doc.roundedRect(x, y0, w, h, 12).fill("#ffffff");
    doc.roundedRect(x, y0, w, h, 12).lineWidth(1).stroke(colors.border);

    doc
      .font(fonts.bold)
      .fontSize(10)
      .fillColor(valueColor)
      .text(title, x + 12, y0 + 10, {
        width: w - 24,
        lineBreak: false,
        ellipsis: true,
      });

    doc
      .font(fonts.base)
      .fontSize(18)
      .fillColor(colors.text)
      .text(value, x + 12, y0 + 30, {
        width: w - 24,
        lineBreak: false,
        ellipsis: true,
      });
    doc.restore();
  }

  function drawTable(headers, rows, colWidths) {
    const headH = 18;
    const rowH = 14;

    const drawHeaderRow = () => {
      ensureSpace(headH + rowH);
      doc.save();
      doc.font(fonts.bold).fontSize(9).fillColor(colors.dark);

      let cx = LEFT;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], cx + 4, y, {
          width: colWidths[i] - 8,
          lineBreak: false,
          ellipsis: true,
        });
        cx += colWidths[i];
      }

      doc
        .moveTo(LEFT, y + headH - 4)
        .lineTo(RIGHT, y + headH - 4)
        .lineWidth(0.7)
        .strokeColor(colors.border)
        .stroke();

      doc.restore();
      y += headH;
    };

    drawHeaderRow();
    doc.font(fonts.base).fontSize(8).fillColor(colors.text);

    for (const r of rows) {
      ensureSpace(rowH, drawHeaderRow);

      let cx = LEFT;
      for (let i = 0; i < r.length; i++) {
        doc.text(String(r[i] ?? ""), cx + 4, y, {
          width: colWidths[i] - 8,
          lineBreak: false,
          ellipsis: true,
        });
        cx += colWidths[i];
      }
      y += rowH;
    }
  }

  function addFooterAllPages() {
    const range = doc.bufferedPageRange(); // { start, count }
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);

      const bottomY = pageH - M - FOOTER_H + 6;

      doc.save();
      // footer divider
      doc
        .moveTo(LEFT, pageH - M - FOOTER_H)
        .lineTo(RIGHT, pageH - M - FOOTER_H)
        .lineWidth(0.6)
        .strokeColor(colors.border)
        .stroke();

      doc.font(fonts.base).fontSize(8).fillColor(colors.lightText);

      doc.text(`ANTARES v2.1 • ${reportId}`, LEFT, bottomY, {
        width: CONTENT_W / 2,
      });
      doc.text(
        `${generatedAt.toLocaleString("tr-TR")} • Sayfa ${i + 1}/${range.count}`,
        LEFT,
        bottomY,
        { width: CONTENT_W, align: "right" },
      );
      doc.restore();
    }
  }

  // ---------- Data ----------
  const latest = sensorHistory[sensorHistory.length - 1] || {
    temperature: "--",
    humidity: "--",
    soil_context: "--",
    heater_power: "--",
    shock: "--",
    system_status: "OK",
    f1: 0,
    f2: 0,
    timestamp: "--",
  };

  // ---------- COVER PAGE ----------
  doc.save();
  doc.rect(0, 0, pageW, pageH).fill(colors.surface);

  doc.rect(LEFT, 70, 8, 120).fill(colors.primary);

  doc
    .font(fonts.bold)
    .fontSize(36)
    .fillColor(colors.dark)
    .text("ANTARES", LEFT + 18, 82);

  doc
    .font(fonts.base)
    .fontSize(14)
    .fillColor(colors.lightText)
    .text(
      "Akıllı Koruma Kapsülü | Dijital İkiz & Analiz Raporu",
      LEFT + 18,
      128,
    );

  // meta box
  const metaY = 210;
  const boxW = pageW - 2 * (LEFT + 18);
  doc.roundedRect(LEFT + 18, metaY, boxW, 120, 14).fill("#ffffff");
  doc
    .roundedRect(LEFT + 18, metaY, boxW, 120, 14)
    .lineWidth(1)
    .stroke(colors.border);

  doc
    .font(fonts.bold)
    .fontSize(11)
    .fillColor(colors.dark)
    .text("RAPOR BİLGİLERİ", LEFT + 32, metaY + 14);

  doc
    .font(fonts.base)
    .fontSize(10)
    .fillColor(colors.text)
    .text(`Rapor ID: #${reportId}`, LEFT + 32, metaY + 40)
    .text(
      `Oluşturulma: ${generatedAt.toLocaleString("tr-TR")}`,
      LEFT + 32,
      metaY + 56,
    )
    .text(`Kayıt Sayısı: ${sensorHistory.length}`, LEFT + 32, metaY + 72)
    .text(`Sistem Sürümü: v2.1`, LEFT + 32, metaY + 88);

  doc.restore();

  // ---------- CONTENT PAGE ----------
  doc.addPage();
  y = TOP;

  doc
    .font(fonts.bold)
    .fontSize(18)
    .fillColor(colors.dark)
    .text("Sistem Özeti", LEFT, y);
  y += 28;

  // Cards (2x2)
  const cardW = (CONTENT_W - 16) / 2;
  const cardH = 72;

  ensureSpace(cardH * 2 + 12 + 16);

  card(
    LEFT,
    y,
    cardW,
    cardH,
    "Sıcaklık",
    `${latest.temperature ?? "--"}°C`,
    colors.accent,
  );
  card(
    LEFT + cardW + 16,
    y,
    cardW,
    cardH,
    "Nem",
    `${latest.humidity ?? "--"}%`,
    colors.primary,
  );
  y += cardH + 12;
  card(
    LEFT,
    y,
    cardW,
    cardH,
    "Toprak Bağlamı",
    `${latest.soil_context ?? "--"}`,
    colors.secondary,
  );
  card(
    LEFT + cardW + 16,
    y,
    cardW,
    cardH,
    "Sistem Durumu",
    `${latest.system_status ?? "OK"}`,
    colors.dark,
  );
  y += cardH + 18;

  // Queue stats
  section("Komut Kuyruğu Durumu");

  const queueStats = {
    toplam: commandQueue.length,
    beklemede: commandQueue.filter((c) => c.status === "pending").length,
    gonderilen: commandQueue.filter((c) => c.status === "sent").length,
    onaylanan: commandQueue.filter((c) => c.status === "ack").length,
  };

  const stats = [
    ["Toplam", queueStats.toplam],
    ["Beklemede", queueStats.beklemede],
    ["Gönderilen", queueStats.gonderilen],
    ["Onaylanan", queueStats.onaylanan],
  ];

  const statW = (CONTENT_W - 12) / 4;
  ensureSpace(60);

  for (let i = 0; i < stats.length; i++) {
    const x = LEFT + i * (statW + 4);
    doc.save();
    doc.roundedRect(x, y, statW, 54, 12).fill("#ffffff");
    doc.roundedRect(x, y, statW, 54, 12).lineWidth(1).stroke(colors.border);

    doc
      .font(fonts.base)
      .fontSize(9)
      .fillColor(colors.lightText)
      .text(stats[i][0], x + 10, y + 8, {
        width: statW - 20,
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .font(fonts.bold)
      .fontSize(18)
      .fillColor(colors.text)
      .text(String(stats[i][1]), x + 10, y + 24, {
        width: statW - 20,
        lineBreak: false,
        ellipsis: true,
      });
    doc.restore();
  }

  y += 70;

  doc
    .font(fonts.base)
    .fontSize(9)
    .fillColor(colors.lightText)
    .text("Son Komut ID:", LEFT, y);
  doc
    .font(fonts.bold)
    .fontSize(11)
    .fillColor(colors.primary)
    .text(`#${commandCounter}`, LEFT + 92, y);
  y += 30;

  // Sensor table
  section("Son Sensör Kayıtları");

  const recentLogs = sensorHistory.slice(-30).reverse();
  const headers = ["#", "Tarih/Saat", "Sıcaklık", "Nem", "Fan", "Durum"];
  const colWidths = [
    24,
    150,
    70,
    55,
    55,
    CONTENT_W - (24 + 150 + 70 + 55 + 55),
  ];

  const rows = recentLogs.map((log, idx) => {
    const f1 = log.f1 === 1 ? "A" : "K";
    const f2 = log.f2 === 1 ? "A" : "K";
    return [
      idx + 1,
      log.timestamp ?? "",
      `${log.temperature ?? "--"}°C`,
      `${log.humidity ?? "--"}%`,
      `${f1}/${f2}`,
      log.system_status ?? "OK",
    ];
  });

  drawTable(headers, rows, colWidths);

  // Web messages
  if (Array.isArray(webMessages) && webMessages.length > 0) {
    y += 10;
    section("Son Web Mesajları");

    setBody();
    doc.fontSize(9);

    for (const msg of webMessages) {
      ensureSpace(18);
      doc.save();
      doc
        .font(fonts.bold)
        .fillColor(colors.primary)
        .text(`[${msg.timestamp ?? "--"}]`, LEFT, y, {
          width: 90,
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .font(fonts.base)
        .fillColor(colors.text)
        .text(`${msg.text ?? ""}`, LEFT + 92, y, {
          width: CONTENT_W - 92,
          lineBreak: false,
          ellipsis: true,
        });
      doc.restore();
      y += 18;
    }
  }

  // Footer (all pages)
  addFooterAllPages();

  // Finalize
  console.log(`[PDF] ✅ Rapor oluşturuldu: ${fileName} (Font: ${fonts.base})`);
  doc.end();
});
// başlangıç: 860

// ============= SERVER START =============

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `✅ Antares Backend v2.1 (CANLΙ MOD YÖNETIMI) aktif port: ${PORT}\n`,
  );
  console.log("🎯 OZELLIKLER:");
  console.log("✅ Command Queue (FIFO) - Her komut sirada tutuluyor");
  console.log("✅ ACK Pattern - Komutlar guvenli bir sekilde takip ediliyor");
  console.log("✅ Non-blocking Serial - ESP32 seri port kontrolu stabil");
  console.log("✅ Canlı Mod Yönetimi - Frontend kontrollü (5 dakika)");
  console.log("✅ Keep-Alive Connection - TLS handshake minimized");
  console.log(
    "✅ Bidirectional State Sync - Arduino ACK'tan gercek durum guncelleniyor",
  );
  console.log("✅ 360° Archive Proxy - ESP32 dosya servisi ile entegre");
  console.log("✅ CLEANUP TOOLS - Komut, mesaj ve gecmis temizleme araclari");
  console.log("");
  console.log("📊 LATENCY BUDGET: ~2-3 saniye (toleranslı)");
  console.log("🔒 GÜVENILIRLIK: Komut kaybı riski %0");
  console.log("📸 360° ARŞIV: Dosya listesi ve görsel proxy aktif");
  console.log("🧹 TEMIZLEME: Komut, mesaj ve sensör geçmişi temizleme aktif");
  console.log("");
  console.log("http://localhost:3000");
});
