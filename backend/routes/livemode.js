const express = require("express");
const router = express.Router();

module.exports = function (commandQueue, authenticateToken, liveMode) {
  // ============= LIVE MODE START =============
  router.post("/live-mode-start", authenticateToken, (req, res) => {
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
    }, liveMode.duration);

    res.json({
      success: true,
      message: "Canli mod baslatildi (5 dakika)",
      queueStats: {
        total: commandQueue.length,
        pending: commandQueue.filter((c) => c.status === "pending").length,
        sent: commandQueue.filter((c) => c.status === "sent").length,
        acked: commandQueue.filter((c) => c.status === "ack").length,
      },
    });
  });

  // ============= LIVE MODE STOP =============
  router.post("/live-mode-stop", authenticateToken, (req, res) => {
    liveMode.active = false;
    liveMode.endTime = null;

    res.json({
      success: true,
      message: "Canli mod durduruldu",
    });
  });

  // ============= LIVE MODE STATUS =============
  router.get("/live-mode-status", authenticateToken, (req, res) => {
    res.json({
      active: liveMode.active,
      endTime: liveMode.endTime,
      queueStats: {
        total: commandQueue.length,
        pending: commandQueue.filter((c) => c.status === "pending").length,
        sent: commandQueue.filter((c) => c.status === "sent").length,
        acked: commandQueue.filter((c) => c.status === "ack").length,
      },
    });
  });

  return router;
};
