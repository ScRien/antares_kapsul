const express = require("express");
const { generateReport } = require("../services/pdfGenerator");

const router = express.Router();

/**
 * PDF Rapor Oluştur ve İndir
 * GET /api/reports/pdf
 */
router.get("/pdf", (req, res) => {
  // Token kontrolü (middleware kullanabilirsin)
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token gerekli" });
  }

  // Backend'de tutılan veriler (bu veriler main index.js'de global olmalı)
  // generateReport'a geçilecek

  // generateReport(res, sensorHistory, commandQueue, webMessages);

  // Şimdilik örnek veri
  const sensorHistory = global.sensorHistory || [];
  const commandQueue = global.commandQueue || [];
  const webMessages = global.webMessages || [];

  generateReport(res, sensorHistory, commandQueue, webMessages);
});

/**
 * Rapor Metadata (dosya bilgisi)
 * GET /api/reports/info
 */
router.get("/info", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token gerekli" });
  }

  const sensorHistory = global.sensorHistory || [];
  const commandQueue = global.commandQueue || [];

  res.json({
    sensorRecords: sensorHistory.length,
    commandsTotal: commandQueue.length,
    commandsPending: commandQueue.filter((c) => c.status === "pending").length,
    generatedAt: new Date().toLocaleString("tr-TR"),
  });
});

module.exports = router;
