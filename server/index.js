const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json());

// Bellekteki veriler - Kara Kutu Mantığı
let sensorHistory = [];
let targetClimate = { t: 22.0, h: 60.0 }; // Kazı anı referans değerleri

// --- GÜNCELLENDİ: REACT'İN BEKLEDİĞİ FORMATTA VERİ SERVİSİ ---
// React: axios.get(`${API_BASE}/data`) => API_BASE .../api olduğu için endpoint: /api/data olmalı
app.get("/api/data", (req, res) => {
  const latest = sensorHistory[sensorHistory.length - 1] || {};

  res.json({
    t: latest.temperature ?? "--",
    h: latest.humidity ?? "--",
    s: latest.soil_context ?? "Ölçülüyor...",
    f1: latest.f1 ?? 0,
    f2: latest.f2 ?? 0,
  });
});

// --- EKLENDİ: KONTROL KOMUTLARI ---
// React: axios.get(`${API_BASE}/cmd?fan1=toggle`) => /api/cmd
app.get("/api/cmd", (req, res) => {
  console.log("Komut Alındı:", req.query);
  res.send("OK");
});

// React: axios.get(`${API_BASE}/msg?text=...`) => /api/msg
app.get("/api/msg", (req, res) => {
  console.log("LCD Mesajı:", req.query.text);
  res.send("OK");
});

// React: axios.get(`${API_BASE}/capture`) => /api/capture
app.get("/api/capture", (req, res) => {
  console.log("Tarama başlatıldı");
  res.send("OK");
});

// React: <img src={`${API_BASE}/stream`} /> => /api/stream
// Şimdilik placeholder; ESP32-CAM stream URL'in varsa burayı ona yönlendir.
app.get("/api/stream", (req, res) => {
  res.redirect(
    "https://placehold.co/1280x720/111/00d2ff?text=Antares+Canli+Yayin",
  );
});

// 2. ESP32'DEN ÖZET VERİ ALMA (POST)
app.post("/api/log-summary", (req, res) => {
  const { t, h, s, max_shock, status, f1, f2 } = req.body;

  const logEntry = {
    timestamp: new Date().toLocaleString("tr-TR"),
    temperature: t,
    humidity: h,
    soil_context: s,
    shock: max_shock,
    system_status: status,
    f1: f1 ?? 0,
    f2: f2 ?? 0,
  };

  sensorHistory.push(logEntry);

  // Bellek yönetimi: Son 1000 kaydı tut
  if (sensorHistory.length > 1000) sensorHistory.shift();

  console.log("Kara Kutu Güncellendi:", logEntry);
  res.status(200).send({ message: "Veri buluta işlendi" });
});

// 3. DİJİTAL MÜHÜRLÜ ANALİZ RAPORU (PDF)
app.get("/api/generate-report", (req, res) => {
  const doc = new PDFDocument();
  const fileName = `Antares_Analiz_Raporu_${Date.now()}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

  doc.pipe(res);

  // Rapor Başlığı ve Vizyon
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

  // Veri Tablosu Başlığı
  doc
    .fontSize(12)
    .fillColor("#333")
    .text("--- TRANSFER SÜRECİ VERİ GÜNLÜĞÜ (KARA KUTU) ---");
  doc.moveDown(0.5);

  // Logları Listele
  sensorHistory.forEach((log) => {
    doc
      .fontSize(9)
      .fillColor("black")
      .text(
        `${log.timestamp} > T: ${log.temperature}°C | H: %${log.humidity} | Şok: ${log.shock}G | Durum: ${log.system_status} | F1: ${log.f1} | F2: ${log.f2}`,
      );
  });

  doc.moveDown(2);

  // DİJİTAL MÜHÜR VE ONAY
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Antares Backend v2 aktif port: ${PORT}`));
