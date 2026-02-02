import { useState, useEffect } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";

export const useSensorData = () => {
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveModeStatus, setLiveModeStatus] = useState({
    active: false,
    queueStats: { total: 0, pending: 0, sent: 0, acked: 0 },
  });

  // ============= SENSÖR VERİSİ POLLING (15 saniye) =============
  useEffect(() => {
    const fetchSensorData = async () => {
      try {
        const res = await fetch(`${API_BASE}/data`);
        const data = await res.json();
        setSensorData(data);
        setError(null);
      } catch (err) {
        setError("Sensör verisi alınamadı: " + err.message);
        console.error("❌ Sensör hata:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSensorData();
    const interval = setInterval(fetchSensorData, 15000); // 15 saniye
    return () => clearInterval(interval);
  }, []);

  // ============= CANLΙ MOD DURUMU POLLING (5 saniye) =============
  useEffect(() => {
    const checkLiveModeStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/live-mode-status`);
        const data = await res.json();
        setLiveModeStatus(data);
      } catch (err) {
        console.error("❌ Canlı mod durum hatası:", err);
      }
    };

    checkLiveModeStatus();
    const interval = setInterval(checkLiveModeStatus, 5000); // 5 saniye
    return () => clearInterval(interval);
  }, []);

  return { sensorData, loading, error, liveModeStatus };
};

// ============= CANLΙ MOD KONTROL FONKSİYONLARI =============

export const startLiveMode = async () => {
  try {
    const res = await fetch(`${API_BASE}/live-mode-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message);
    }
    console.log("✅ Canlı mod başlatıldı");
    return data;
  } catch (err) {
    console.error("❌ Canlı mod başlatma hatası:", err);
    throw err;
  }
};

export const stopLiveMode = async () => {
  try {
    const res = await fetch(`${API_BASE}/live-mode-stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message);
    }
    console.log("✅ Canlı mod durduruldu");
    return data;
  } catch (err) {
    console.error("❌ Canlı mod durdurma hatası:", err);
    throw err;
  }
};
