const express = require("express");
const router = express.Router();

module.exports = function(sensorData, sensorHistory, commandQueue, authenticateToken) {
  // ============= GET SENSOR DATA =============
  router.get("/data", authenticateToken, (req, res) => {
    res.json(sensorData);
  });

  // ============= GET SENSOR HISTORY =============
  router.get("/history", authenticateToken, (req, res) => {
    res.json({
      count: sensorHistory.length,
      data: sensorHistory.slice(-100),
    });
  });

  // ============= GET PENDING COMMANDS =============
  router.get("/pending-cmd", authenticateToken, (req, res) => {
    const pending = commandQueue.filter((c) => c.status === "pending");
    res.json({
      count: pending.length,
      commands: pending,
    });
  });

  return router;
};