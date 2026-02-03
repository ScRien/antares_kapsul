const express = require("express");
const router = express.Router();

module.exports = function (
  commandQueue,
  sensorHistory,
  webMessages,
  authenticateToken,
) {
  // ============= CLEANUP COMMANDS =============
  router.post("/commands", authenticateToken, (req, res) => {
    const originalLength = commandQueue.length;
    commandQueue.length = 0; // Boşalt
    res.json({
      success: true,
      message: `${originalLength} komut temizlendi`,
    });
  });

  // ============= CLEANUP MESSAGES =============
  router.post("/messages", authenticateToken, (req, res) => {
    const originalLength = webMessages.length;
    webMessages.length = 0; // Boşalt
    res.json({
      success: true,
      message: `${originalLength} mesaj temizlendi`,
    });
  });

  // ============= CLEANUP HISTORY =============
  router.post("/history", authenticateToken, (req, res) => {
    const originalLength = sensorHistory.length;
    sensorHistory.length = 0; // Boşalt
    res.json({
      success: true,
      message: `${originalLength} gecmis kaydi temizlendi`,
    });
  });

  // ============= CLEANUP ALL =============
  router.post("/all", authenticateToken, (req, res) => {
    const cmdLen = commandQueue.length;
    const msgLen = webMessages.length;
    const histLen = sensorHistory.length;

    commandQueue.length = 0;
    webMessages.length = 0;
    sensorHistory.length = 0;

    res.json({
      success: true,
      message: "Tum veriler temizlendi",
      cleaned: {
        commands: cmdLen,
        messages: msgLen,
        history: histLen,
      },
    });
  });

  return router;
};
