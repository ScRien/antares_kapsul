const express = require("express");
const router = express.Router();

module.exports = function (authenticateToken) {
  // ============= ARCHIVE LIST =============
  router.get("/list", authenticateToken, (req, res) => {
    // Mock file list
    const mockFiles = [
      {
        name: "202501231430_001.jpg",
        size: 45000,
        timestamp: "23.01.2025 14:30",
      },
      {
        name: "202501231430_002.jpg",
        size: 42000,
        timestamp: "23.01.2025 14:30",
      },
      {
        name: "202501231430_003.jpg",
        size: 44000,
        timestamp: "23.01.2025 14:30",
      },
    ];

    res.json({
      success: true,
      count: mockFiles.length,
      files: mockFiles,
    });
  });

  // ============= ARCHIVE FILE =============
  router.get("/file", authenticateToken, (req, res) => {
    // Placeholder image
    const placeholder = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    res.setHeader("Content-Type", "image/png");
    res.send(placeholder);
  });

  return router;
};
