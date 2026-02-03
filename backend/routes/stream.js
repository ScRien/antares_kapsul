const express = require("express");
const router = express.Router();

module.exports = function (authenticateToken) {
  // ============= STREAM ENDPOINT =============
  router.get("/stream", authenticateToken, (req, res) => {
    // Placeholder image (1x1 transparent PNG)
    const placeholder = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    res.setHeader("Content-Type", "image/png");
    res.send(placeholder);
  });

  return router;
};
