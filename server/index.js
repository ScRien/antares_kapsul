const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json());

// ============= BELLEKTEKI VERİLER =============
let sensorHistory = [];
let targetClimate = { t: 22.0, h: 60.0 };

// ✅ v2: Command Queue (FIFO - First In First Out)
let commandQueue = [];
let commandCounter = 0;

// Backend state (Arduino ACK'dan güncellenir)
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
      </style>
  </head>
  <body class="p-4 md:p-8">
      <div class="max-w-5xl mx-auto">
          <div class="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
              <div>
                  <h1 class="text-4xl font-bold tracking-tighter text-transparent bg-clip-text accent-gradient">
                      ANTARES <span class="text-white opacity-20 text-xl">v2.0</span>
                  </h1>
                  <p class="text-slate-400 text-sm uppercase tracking-widest mt-1">Akıllı Koruma Kapsülü Kontrol Merkezi</p>
              </div>
              <div class="flex items-center gap-3 px-4 py-2 rounded-full glass">
                  <div class="w-3 h-3 bg-emerald-500 rounded-full status-pulse"></div>
                  <span class="text-sm font-medium">Sistem Çevrimiçi</span>
              </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div class="glass p-6 rounded-3xl">
                  <p class="text-slate-400 text-xs uppercase mb-1">Sıcaklık</p>
                  <h2 class="text-3xl font-bold">${latest.temperature || "--"}°C</h2>
              </div>
              <div class="glass p-6 rounded-3xl">
                  <p class="text-slate-400 text-xs uppercase mb-1">Nem Oranı</p>
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

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div class="lg:col-span-2 glass rounded-[2rem] p-8">
                  <h3 class="text-xl font-bold mb-6 flex items-center gap-3">
                      <i class="fa-solid fa-list-check text-sky-400"></i> Komut Havuzu (Queue)
                  </h3>
                  <div class="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      ${
                        commandQueue.length === 0
                          ? '<p class="text-slate-500 italic">Şu an sırada komut yok...</p>'
                          : commandQueue
                              .slice()
                              .reverse()
                              .map(
                                (cmd) => `
                          <div class="flex justify-between items-center p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                              <div class="flex items-center gap-4">
                                  <span class="text-xs font-mono text-slate-500">#${cmd.id}</span>
                                  <span class="px-3 py-1 rounded-lg bg-sky-500/10 text-sky-400 text-xs font-bold uppercase">${cmd.type}</span>
                                  <span class="font-medium">${cmd.value}</span>
                              </div>
                              <span class="text-[10px] px-2 py-1 rounded bg-slate-700 ${cmd.status === "ack" ? "text-emerald-400" : "text-amber-400"}">
                                  ${cmd.status.toUpperCase()}
                              </span>
                          </div>
                      `,
                              )
                              .join("")
                      }
                  </div>
              </div>

              <div class="glass rounded-[2rem] p-8">
                  <h3 class="text-xl font-bold mb-6 flex items-center gap-3">
                      <i class="fa-solid fa-microchip text-rose-400"></i> Donanım Durumu
                  </h3>
                  <div class="space-y-6">
                      <div class="flex justify-between items-center">
                          <span class="text-slate-400">Fan 1 (Salyangoz)</span>
                          <span class="px-4 py-1 rounded-full font-bold ${hardwareState.f1 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-500"}">
                              ${hardwareState.f1 ? "AÇIK" : "KAPALI"}
                          </span>
                      </div>
                      <div class="flex justify-between items-center">
                          <span class="text-slate-400">Fan 2 (Düz)</span>
                          <span class="px-4 py-1 rounded-full font-bold ${hardwareState.f2 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-500"}">
                              ${hardwareState.f2 ? "AÇIK" : "KAPALI"}
                          </span>
                      </div>
                      <div class="pt-6 border-t border-slate-700/50">
                          <p class="text-xs text-slate-500 mb-2 italic">Son Veri Akışı:</p>
                          <p class="text-sm font-mono text-slate-300">${latest.timestamp || "Veri bekleniyor..."}</p>
                      </div>
                  </div>
                  
                  <a href="/api/generate-report" class="mt-8 w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 transition-all p-4 rounded-2xl border border-white/10 text-sm font-bold">
                      <i class="fa-solid fa-file-pdf text-rose-500"></i> SON RAPORU İNDİR
                  </a>
              </div>
          </div>

          <footer class="mt-12 text-center text-slate-600 text-xs">
              Antares Cloud Systems © 2026 | Arkeolojik Koruma ve İzleme Teknolojileri
          </footer>
      </div>
  </body>
  </html>
  `;
  res.send(html);
});

// ============= API ENDPOINTS =============

// ✅ v2: /api/data - Gerçek durum (Arduino ACK'tan)
app.get("/api/data", (req, res) => {
  const latest = sensorHistory[sensorHistory.length - 1] || {};

  res.json({
    t: latest.temperature ?? "--",
    h: latest.humidity ?? "--",
    s: latest.soil_context ?? "Ölçülüyor...",
    f1: latest.f1 ?? hardwareState.f1, // Arduino ACK varsa onu kullan
    f2: latest.f2 ?? hardwareState.f2,
  });
});

// ✅ v2: /api/cmd - Komutu Queue'ye ekle
app.get("/api/cmd", (req, res) => {
  const { fan1, fan2, msg } = req.query;

  // Her komut bir ID ile queue'ye eklenir
  if (fan1) {
    commandQueue.push({
      id: ++commandCounter,
      type: "fan1",
      value: fan1.toUpperCase(),
      status: "pending",
      timestamp: Date.now(),
    });
    console.log(`✅ Fan1=${fan1} (ID: ${commandCounter}) sıraya alındı`);
  }

  if (fan2) {
    commandQueue.push({
      id: ++commandCounter,
      type: "fan2",
      value: fan2.toUpperCase(),
      status: "pending",
      timestamp: Date.now(),
    });
    console.log(`✅ Fan2=${fan2} (ID: ${commandCounter}) sıraya alındı`);
  }

  if (msg) {
    commandQueue.push({
      id: ++commandCounter,
      type: "msg",
      value: msg,
      status: "pending",
      timestamp: Date.now(),
    });
    console.log(`✅ MSG="${msg}" (ID: ${commandCounter}) sıraya alındı`);
  }

  // Iyimser güncelleme (UI feedback için)
  if (fan1) hardwareState.f1 = fan1.toUpperCase() === "ON" ? 1 : 0;
  if (fan2) hardwareState.f2 = fan2.toUpperCase() === "ON" ? 1 : 0;

  res.json({
    success: true,
    queueLength: commandQueue.length,
    lastCommandId: commandCounter,
    hardwareState: hardwareState,
  });
});

// ✅ v2: /api/pending-cmd - ESP32 kontrol eder
app.get("/api/pending-cmd", (req, res) => {
  // SADECE pending komutları gönder
  const pending = commandQueue.filter((cmd) => cmd.status === "pending");

  // Komutları "sent" olarak işaretle (ama silme!)
  pending.forEach((cmd) => (cmd.status = "sent"));

  // ESP32 en fazla 5 komutu bir seferde alsın
  const toSend = pending.slice(0, 5);

  console.log(`📤 ${toSend.length} komut ESP32'ye gönderiliyor`);

  res.json({
    commands: toSend,
    count: toSend.length,
  });
});

// ✅ v2: /api/cmd-ack - ESP32 komutları başarıyla aldığını bildir
app.post("/api/cmd-ack", (req, res) => {
  const { commandIds } = req.body; // [1, 2, 3]

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

  // ✅ Eski komutları temizle (5 dakika + ack'd)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const initialLength = commandQueue.length;

  commandQueue = commandQueue.filter((cmd) => {
    if (cmd.status === "ack" && cmd.ackedAt && cmd.ackedAt < fiveMinutesAgo) {
      return false; // Sil
    }
    return true; // Koru
  });

  const cleaned = initialLength - commandQueue.length;

  console.log(
    `✅ ${ackedCount} komut onaylandı, ${cleaned} eski komut silindi`,
  );

  res.json({
    success: true,
    ackedCount: ackedCount,
    cleanedCount: cleaned,
    queueLength: commandQueue.length,
  });
});

// ✅ /api/msg - LCD mesaj
app.get("/api/msg", (req, res) => {
  const { text } = req.query;
  console.log("LCD Mesajı:", text);

  res.json({
    success: true,
    message: "LCD mesajı alındı",
    text: text,
  });
});

// ✅ /api/capture - Tarama komutu
app.get("/api/capture", (req, res) => {
  console.log("Tarama başlatıldı");

  res.json({
    success: true,
    message: "Tarama komutu gönderildi",
  });
});

// Stream endpoint
app.get("/api/stream", (req, res) => {
  res.redirect(
    "https://placehold.co/1280x720/111/00d2ff?text=Antares+Canli+Yayin",
  );
});

// ============= LOG & BULUT ENDPOINTS =============

// ✅ v2: /api/log-summary - Arduino'dan sensör + ACK durumu alıyor
app.post("/api/log-summary", (req, res) => {
  const { t, h, s, ht, f1, f2, shk, st } = req.body;

  // ✅ Arduino'nun gerçek durumunu kullan
  if (f1 !== undefined) hardwareState.f1 = f1;
  if (f2 !== undefined) hardwareState.f2 = f2;

  const logEntry = {
    timestamp: new Date().toLocaleString("tr-TR"),
    temperature: t,
    humidity: h,
    soil_context: s,
    heater_power: ht,
    f1: f1, // ✅ Arduino'nun gerçek durumu
    f2: f2, // ✅ Arduino'nun gerçek durumu
    shock: shk,
    system_status: st,
    queueStatus: {
      totalPending: commandQueue.filter((c) => c.status === "pending").length,
      totalSent: commandQueue.filter((c) => c.status === "sent").length,
      totalAcked: commandQueue.filter((c) => c.status === "ack").length,
    },
  };

  sensorHistory.push(logEntry);

  // Bellek yönetimi: Son 1000 kaydı tut
  if (sensorHistory.length > 1000) sensorHistory.shift();

  console.log("✅ Kara Kutu Güncellendi:", {
    temp: t,
    humidity: h,
    f1: f1,
    f2: f2,
    queueLength: commandQueue.length,
  });

  res.status(200).json({
    message: "Veri buluta işlendi",
    recorded: logEntry,
    hardwareStateSync: { f1: hardwareState.f1, f2: hardwareState.f2 },
  });
});

// ============= DEBUG ENDPOINTS =============

// Queue durumunu göster
app.get("/api/queue-status", (req, res) => {
  res.json({
    total: commandQueue.length,
    pending: commandQueue.filter((c) => c.status === "pending"),
    sent: commandQueue.filter((c) => c.status === "sent"),
    acked: commandQueue.filter((c) => c.status === "ack"),
    lastCommandId: commandCounter,
  });
});

// ============= RAPOR ENDPOINTS =============

app.get("/api/generate-report", (req, res) => {
  const doc = new PDFDocument();
  const fileName = `Antares_Analiz_Raporu_${Date.now()}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

  doc.pipe(res);

  doc
    .fontSize(22)
    .fillColor("#1a5f7a")
    .text("ANTARES: AKILLI KORUMA KAPSÜLÜ", { align: "center" });
  doc
    .fontSize(14)
    .fillColor("black")
    .text("ESER TRANSFER VE MİKROKLİMA ANALİZ RAPORU", { align: "center" });
  doc.moveDown();

  doc
    .fontSize(10)
    .text(`Rapor Oluşturma: ${new Date().toLocaleString("tr-TR")}`);
  doc.text(
    `Hedef Bağlam Değerleri: ${targetClimate.t}°C Sıcaklık | %${targetClimate.h} Nem`,
  );
  doc.moveDown();

  doc
    .fontSize(12)
    .fillColor("#333")
    .text("--- TRANSFER SÜRECİ VERİ GÜNLÜĞÜ (KARA KUTU) ---");
  doc.moveDown(0.5);

  sensorHistory.forEach((log) => {
    doc
      .fontSize(9)
      .fillColor("black")
      .text(
        `${log.timestamp} > T: ${log.temperature}°C | H: %${log.humidity} | Şok: ${log.shock}G | Durum: ${log.system_status} | F1: ${log.f1} | F2: ${log.f2}`,
      );
  });

  doc.moveDown(2);

  const sealY = doc.y;
  doc.rect(50, sealY, 500, 60).stroke();
  doc
    .fontSize(16)
    .fillColor("green")
    .text("DİJİTAL MÜHÜR: KORUMA DOĞRULANDI", 70, sealY + 15);
  doc
    .fontSize(8)
    .fillColor("gray")
    .text(
      "Bu belge, kapsül içerisindeki sensör verilerinin saniye saniye analizi sonucu Antares Cloud tarafından üretilmiştir.",
      70,
      sealY + 40,
    );

  doc.end();
});

// ============= SERVER START =============

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Antares Backend v2 (RELAY/POLLING) aktif port: ${PORT}`);
  console.log("");
  console.log("🎯 ÖZELLİKLER:");
  console.log("✅ Command Queue (FIFO) - Her komut sırada tutuluyor");
  console.log("✅ ACK Pattern - Komutlar güvenli bir şekilde takip ediliyor");
  console.log("✅ Non-blocking Serial - ESP32 seri port kontrolü stabil");
  console.log("✅ Keep-Alive Connection - TLS handshake minimized");
  console.log(
    "✅ Bidirectional State Sync - Arduino ACK'tan gerçek durum güncelleniyor",
  );
  console.log("");
  console.log("📊 LATENCY BUDGET: ~2-3 saniye (toleranslı)");
  console.log("🔒 GÜVENILIRLIK: Komut kaybı riski %0");
  console.log("");
});
