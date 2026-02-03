const express = require("express");
const router = express.Router();

module.exports = function (
  sensorData,
  webMessages,
  commandQueue,
  addCommand,
  authenticateToken,
) {
  const MAX_MESSAGES = 5;

  // ============= COMMAND ENDPOINT (FAN + LCD) =============
  router.get("/cmd", authenticateToken, (req, res) => {
    const { fan1, fan2, msg } = req.query;

    if (fan1) {
      const newValue = fan1 === "ON" ? 1 : 0;
      sensorData.f1 = newValue;
      addCommand("FAN1", fan1);
    }

    if (fan2) {
      const newValue = fan2 === "ON" ? 1 : 0;
      sensorData.f2 = newValue;
      addCommand("FAN2", fan2);
    }

    if (msg) {
      webMessages.unshift({
        timestamp: new Date().toLocaleTimeString("tr-TR"),
        text: msg,
      });
      if (webMessages.length > MAX_MESSAGES) {
        webMessages.pop();
      }
      addCommand("LCD", msg);
    }

    res.json({
      success: true,
      hardwareState: {
        f1: sensorData.f1,
        f2: sensorData.f2,
      },
      message: msg || "Komut alindi",
    });
  });

  return router;
};
