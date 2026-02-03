const express = require("express");
const router = express.Router();

// SYSTEM_PASSWORD ve token fonksiyonları bu dosyanın dışında define edilmeli
// app.js'den inject edilir

module.exports = function (
  SYSTEM_PASSWORD,
  generateToken,
  isValidToken,
  authenticateToken,
) {
  // ============= LOGIN =============
  router.post("/login", (req, res) => {
    const { password } = req.body;

    if (password === SYSTEM_PASSWORD) {
      const token = generateToken();
      res.json({
        success: true,
        token: token,
        user: { username: "Lab Admin", role: "system_admin" },
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Sifre yanlis",
      });
    }
  });

  // ============= VERIFY TOKEN =============
  router.post("/verify", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token yok" });
    }

    const token = authHeader.substring(7);
    if (isValidToken(token)) {
      res.json({
        success: true,
        user: { username: "Lab Admin", role: "system_admin" },
      });
    } else {
      res.status(401).json({ message: "Invalid token" });
    }
  });

  // ============= REFRESH TOKEN =============
  router.post("/refresh", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token yok" });
    }

    const oldToken = authHeader.substring(7);
    if (isValidToken(oldToken)) {
      const newToken = generateToken();
      res.json({ success: true, token: newToken });
    } else {
      res.status(401).json({ message: "Invalid token" });
    }
  });

  return router;
};
