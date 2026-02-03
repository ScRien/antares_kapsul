const path = require("path");
const fs = require("fs");

/**
 * Font yükleme ve fallback yönetimi
 */
function loadFonts(doc) {
  const fontDir = path.join(__dirname, "../fonts");

  const families = [
    { regular: "NotoSans-Regular.ttf", bold: "NotoSans-Bold.ttf" },
    { regular: "DejaVuSans.ttf", bold: "DejaVuSans-Bold.ttf" },
    { regular: "Roboto-Regular.ttf", bold: "Roboto-Bold.ttf" },
    { regular: "Inter-Regular.ttf", bold: "Inter-Bold.ttf" },
  ];

  const fonts = { base: "Helvetica", bold: "Helvetica-Bold" };
  let fontLoaded = false;

  console.log(`[PDF] Font dizini araniyor: ${fontDir}`);

  for (const fam of families) {
    const regPath = path.join(fontDir, fam.regular);
    const boldPath = path.join(fontDir, fam.bold);

    const regExists = fs.existsSync(regPath);
    const boldExists = fs.existsSync(boldPath);

    console.log(
      `[PDF] Kontrol: ${fam.regular} -> ${regExists ? "✅ Bulundu" : "❌ Bulunamadi"}`,
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
          console.log(`[PDF] ⚠️ Bold font bulunmadi, regular kullaniliyor`);
        }
        fontLoaded = true;
        break;
      } catch (e) {
        console.error(
          `[PDF] ❌ Font kaydi hatasi (${fam.regular}):`,
          e.message,
        );
      }
    }
  }

  if (!fontLoaded) {
    console.warn(
      "[PDF] ⚠️ Hicbir Turkce font bulunmadi, Helvetica fallback kullaniliyor",
    );
    console.warn(
      "[PDF] 💡 Cozum: backend/fonts/ klasorune NotoSans-Regular.ttf ekle",
    );
  }

  return fonts;
}

/**
 * Tema renkleri
 */
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

/**
 * Layout sabitleri
 */
function getLayout(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const M = 40;

  return {
    pageW,
    pageH,
    margin: M,
    left: M,
    right: pageW - M,
    contentW: pageW - 2 * M,
    footerH: 34,
    footerGap: 10,
    safeBottom: pageH - M - 34 - 10,
    top: M,
  };
}

/**
 * Report metadata oluştur
 */
function generateReportMetadata() {
  const generatedAt = new Date();
  const isoDate = generatedAt.toISOString().split("T")[0];
  const fileName = `Antares_Analiz_Raporu_${isoDate}.pdf`;
  const reportId = `ANT-${Date.now().toString().slice(-8)}`;

  return {
    fileName,
    reportId,
    generatedAt,
    isoDate,
  };
}

/**
 * PDF document konfigürasyonu
 */
function createPDFConfig() {
  return {
    size: "A4",
    margin: 40,
    bufferPages: true,
    compress: true,
    autoFirstPage: true,
  };
}

/**
 * Response headers ayarla
 */
function setPDFHeaders(res, fileName) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
}

/**
 * Error handling setup
 */
function setupErrorHandling(doc, res) {
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

  return safeEnd;
}

module.exports = {
  loadFonts,
  colors,
  getLayout,
  generateReportMetadata,
  createPDFConfig,
  setPDFHeaders,
  setupErrorHandling,
};
