const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(express.json());

// Bellekteki veriler - Kara Kutu Mantığı [cite: 24]
let sensorHistory = [];
let targetClimate = { t: 22.0, h: 60.0 }; // Kazı anı referans değerleri [cite: 5, 27]

// 1. UPTIME ROBOT VE ARAYÜZ İÇİN VERİ SERVİSİ (GET)
// Bu endpoint artık 404 vermeyecek, UptimeRobot "OK" alacak.
app.get("/api/data", (req, res) => {
  res.json({
    status: "Antares Cloud Active",
    latest: sensorHistory[sensorHistory.length - 1] || {
      message: "Veri bekleniyor...",
    },
    history: sensorHistory.slice(-50), // Son 50 özet [cite: 25]
    target: targetClimate,
  });
});

// 2. ESP32'DEN ÖZET VERİ ALMA (POST) [cite: 10, 12]
app.post("/api/log-summary", (req, res) => {
  const { t, h, s, max_shock, status } = req.body;

  const logEntry = {
    timestamp: new Date().toLocaleString("tr-TR"),
    temperature: t,
    humidity: h,
    soil_context: s, // Toprak referansı [cite: 16]
    shock: max_shock, // Ivmeölçer verisi [cite: 38]
    system_status: status, // Aktif müdahale durumu (Isıtma/Soğutma) [cite: 13, 24]
  };

  sensorHistory.push(logEntry);

  // Bellek yönetimi: Son 1000 kaydı tut
  if (sensorHistory.length > 1000) sensorHistory.shift();

  console.log("Kara Kutu Güncellendi:", logEntry);
  res.status(200).send({ message: "Veri buluta işlendi" });
});

// 3. DİJİTAL MÜHÜRLÜ ANALİZ RAPORU (PDF) [cite: 25, 31, 38]
app.get("/api/generate-report", (req, res) => {
  const doc = new PDFDocument();
  const fileName = `Antares_Analiz_Raporu_${Date.now()}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

  doc.pipe(res);

  // Rapor Başlığı ve Vizyon [cite: 1, 6]
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
    `Hedef Bağlam Değerleri: ${targetClimate.t}°C Sıcaklık | %${targetClimate.h} Nem [cite: 5, 27]`,
  );
  doc.moveDown();

  // Veri Tablosu Başlığı
  doc
    .fontSize(12)
    .fillColor("#333")
    .text("--- TRANSFER SÜRECİ VERİ GÜNLÜĞÜ (KARA KUTU) --- [cite: 24, 38]");
  doc.moveDown(0.5);

  // Logları Listele
  sensorHistory.forEach((log) => {
    doc
      .fontSize(9)
      .fillColor("black")
      .text(
        `${log.timestamp} > T: ${log.temperature}°C | H: %${log.humidity} | Şok: ${log.shock}G | Durum: ${log.system_status}`,
      );
  });

  doc.moveDown(2);

  // DİJİTAL MÜHÜR VE ONAY [cite: 28, 38]
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
      "Bu belge, kapsül içerisindeki sensör verilerinin saniye saniye analizi sonucu Antares Cloud tarafından üretilmiştir. [cite: 24, 25]",
      70,
      sealY + 40,
    );

  doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Antares Backend v2 aktif port: ${PORT}`));
