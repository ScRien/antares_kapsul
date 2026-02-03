const PDFDocument = require("pdfkit");
const {
  loadFonts,
  colors,
  getLayout,
  generateReportMetadata,
  createPDFConfig,
  setPDFHeaders,
  setupErrorHandling,
} = require("../utils/pdfHelpers");

/**
 * PDF Rapor oluştur ve gönder
 */
async function generateReport(res, sensorHistory, commandQueue, webMessages) {
  try {
    // Metadata
    const meta = generateReportMetadata();

    // Headers
    setPDFHeaders(res, meta.fileName);

    // PDF Document
    const doc = new PDFDocument(createPDFConfig());

    // Font yükle
    const fonts = loadFonts(doc);

    // Error handling
    setupErrorHandling(doc, res);

    // Pipe to response
    doc.pipe(res);

    // Layout sabitleri
    const layout = getLayout(doc);

    // State
    let y = layout.top;

    // Helper functions
    const helpers = createHelpers(doc, fonts, colors, layout);

    // ============= PDF OLUŞTUR =============

    // 1. Cover Page
    createCoverPage(doc, fonts, colors, layout, meta);

    // 2. Content Pages
    doc.addPage();
    y = layout.top;

    // Summary
    createSummarySection(doc, fonts, colors, layout, sensorHistory);

    // Queue Stats
    createQueueStatsSection(
      doc,
      fonts,
      colors,
      layout,
      commandQueue,
      sensorHistory,
    );

    // Sensor Logs
    createSensorLogsSection(doc, fonts, colors, layout, sensorHistory, helpers);

    // Web Messages
    if (Array.isArray(webMessages) && webMessages.length > 0) {
      createWebMessagesSection(
        doc,
        fonts,
        colors,
        layout,
        webMessages,
        helpers,
      );
    }

    // 3. Footer (all pages)
    addFooterAllPages(doc, layout, meta, fonts, colors);

    // Finalize
    console.log(`[PDF] ✅ Rapor olusturuldu: ${meta.fileName}`);
    doc.end();
  } catch (err) {
    console.error("[PDF] Generate error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "PDF olusturulamadi" });
    }
  }
}

/**
 * Helper functions factory
 */
function createHelpers(doc, fonts, colors, layout) {
  const {
    left: LEFT,
    right: RIGHT,
    contentW: CONTENT_W,
    safeBottom: SAFE_BOTTOM,
    top: TOP,
  } = layout;
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

  return {
    setBody,
    ensureSpace,
    section,
    card,
    drawTable,
    getY: () => y,
    setY: (val) => (y = val),
  };
}

/**
 * Cover Page oluştur
 */
function createCoverPage(doc, fonts, colors, layout, meta) {
  const { pageW, pageH, left: LEFT } = layout;

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
      "Akilli Koruma Kapsulu | Dijital İkiz & Analiz Raporu",
      LEFT + 18,
      128,
    );

  // Meta box
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
    .text(`Rapor ID: #${meta.reportId}`, LEFT + 32, metaY + 40)
    .text(
      `Olusturulma: ${meta.generatedAt.toLocaleString("tr-TR")}`,
      LEFT + 32,
      metaY + 56,
    )
    .text(`Sistem Surum: v2.1`, LEFT + 32, metaY + 88);

  doc.restore();
}

/**
 * Summary Section
 */
function createSummarySection(doc, fonts, colors, layout, sensorHistory) {
  const latest = sensorHistory[sensorHistory.length - 1] || {
    temperature: "--",
    humidity: "--",
    system_status: "OK",
  };

  const { left: LEFT, contentW: CONTENT_W } = layout;
  let y = layout.top;

  doc
    .font(fonts.bold)
    .fontSize(18)
    .fillColor(colors.dark)
    .text("Sistem Ozetı", LEFT, y);
  y += 28;

  // Cards
  const cardW = (CONTENT_W - 16) / 2;
  const cardH = 72;

  // Helper card function (inline)
  function card(x, y0, w, h, title, value, valueColor) {
    doc.save();
    doc.roundedRect(x, y0, w, h, 12).fill("#ffffff");
    doc.roundedRect(x, y0, w, h, 12).lineWidth(1).stroke(colors.border);

    doc
      .font(fonts.bold)
      .fontSize(10)
      .fillColor(valueColor)
      .text(title, x + 12, y0 + 10, { width: w - 24 });

    doc
      .font(fonts.base)
      .fontSize(18)
      .fillColor(colors.text)
      .text(value, x + 12, y0 + 30, { width: w - 24 });
    doc.restore();
  }

  card(
    LEFT,
    y,
    cardW,
    cardH,
    "Sicaklik",
    `${latest.temperature}°C`,
    colors.accent,
  );
  card(
    LEFT + cardW + 16,
    y,
    cardW,
    cardH,
    "Nem",
    `${latest.humidity}%`,
    colors.primary,
  );
}

/**
 * Queue Stats Section
 */
function createQueueStatsSection(
  doc,
  fonts,
  colors,
  layout,
  commandQueue,
  sensorHistory,
) {
  const { left: LEFT, contentW: CONTENT_W } = layout;
  let y = layout.top + 150;

  const stats = [
    ["Toplam", commandQueue.length],
    ["Beklemede", commandQueue.filter((c) => c.status === "pending").length],
    ["Gonderilen", commandQueue.filter((c) => c.status === "sent").length],
    ["Onaylanan", commandQueue.filter((c) => c.status === "ack").length],
  ];

  const statW = (CONTENT_W - 12) / 4;

  for (let i = 0; i < stats.length; i++) {
    const x = LEFT + i * (statW + 4);
    doc.save();
    doc.roundedRect(x, y, statW, 54, 12).fill("#ffffff");
    doc.roundedRect(x, y, statW, 54, 12).lineWidth(1).stroke(colors.border);

    doc
      .font(fonts.base)
      .fontSize(9)
      .fillColor(colors.lightText)
      .text(stats[i][0], x + 10, y + 8, { width: statW - 20 });

    doc
      .font(fonts.bold)
      .fontSize(18)
      .fillColor(colors.text)
      .text(String(stats[i][1]), x + 10, y + 24, { width: statW - 20 });

    doc.restore();
  }
}

/**
 * Sensor Logs Section
 */
function createSensorLogsSection(
  doc,
  fonts,
  colors,
  layout,
  sensorHistory,
  helpers,
) {
  const { left: LEFT, right: RIGHT, contentW: CONTENT_W } = layout;

  helpers.section("Son Sensor Kayitlari");

  const recentLogs = sensorHistory.slice(-30).reverse();
  const headers = ["#", "Tarih/Saat", "Sicaklik", "Nem", "Durum"];
  const colWidths = [24, 150, 70, 55, CONTENT_W - (24 + 150 + 70 + 55)];

  const rows = recentLogs.map((log, idx) => [
    idx + 1,
    log.timestamp ?? "",
    `${log.temperature ?? "--"}°C`,
    `${log.humidity ?? "--"}%`,
    log.system_status ?? "OK",
  ]);

  helpers.drawTable(headers, rows, colWidths);
}

/**
 * Web Messages Section
 */
function createWebMessagesSection(
  doc,
  fonts,
  colors,
  layout,
  webMessages,
  helpers,
) {
  const { left: LEFT, contentW: CONTENT_W } = layout;

  helpers.section("Son Web Mesajlari");
  helpers.setBody();
  doc.fontSize(9);

  let y = helpers.getY();

  for (const msg of webMessages) {
    helpers.ensureSpace(18);

    doc.save();
    doc
      .font(fonts.bold)
      .fillColor(colors.primary)
      .text(`[${msg.timestamp ?? "--"}]`, LEFT, y, { width: 90 });

    doc
      .font(fonts.base)
      .fillColor(colors.text)
      .text(`${msg.text ?? ""}`, LEFT + 92, y, { width: CONTENT_W - 92 });

    doc.restore();
    y += 18;
    helpers.setY(y);
  }
}

/**
 * Footer ekle (tüm sayfalar)
 */
function addFooterAllPages(doc, layout, meta, fonts, colors) {
  const {
    pageW,
    pageH,
    left: LEFT,
    right: RIGHT,
    contentW: CONTENT_W,
    margin: M,
  } = layout;
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    const bottomY = pageH - M - 34 + 6;

    doc.save();

    // Divider
    doc
      .moveTo(LEFT, pageH - M - 34)
      .lineTo(RIGHT, pageH - M - 34)
      .lineWidth(0.6)
      .strokeColor(colors.border)
      .stroke();

    // Footer text
    doc.font(fonts.base).fontSize(8).fillColor(colors.lightText);

    doc.text(`ANTARES v2.1 • ${meta.reportId}`, LEFT, bottomY, {
      width: CONTENT_W / 2,
    });

    doc.text(
      `${meta.generatedAt.toLocaleString("tr-TR")} • Sayfa ${i + 1}/${range.count}`,
      LEFT,
      bottomY,
      { width: CONTENT_W, align: "right" },
    );

    doc.restore();
  }
}

module.exports = {
  generateReport,
};
