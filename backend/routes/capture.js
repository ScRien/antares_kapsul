const express = require("express");
const router = express.Router();

module.exports = function (addCommand, authenticateToken) {
  // ============= CAPTURE (360 SCAN) =============
  router.get("/capture", authenticateToken, (req, res) => {
    addCommand("SCAN360", "START");
    res.json({
      success: true,
      message: "360 tarama komutu gonderildi",
    });
  });

  return router;
};
