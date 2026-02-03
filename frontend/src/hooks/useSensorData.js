import { useState, useEffect } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";

export const useSensorData = (token, isLoggedIn) => {
  // ✅ İlk değerleri tanımla - null olmasın!
  const [sensorData, setSensorData] = useState({
    t: "--",
    h: "--",
    s: "Bağlantısız",
    f1: 0,
    f2: 0,
    frameTimestamp: new Date().toLocaleTimeString("tr-TR"),
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastDataUpdate, setLastDataUpdate] = useState(new Date());
  const [liveModeStatus, setLiveModeStatus] = useState({
    active: false,
    queueStats: { total: 0, pending: 0, sent: 0, acked: 0 },
  });

  // ============= SENSÖR VERİSİ POLLING (15 saniye) =============
  useEffect(() => {
    if (!isLoggedIn || !token) {
      setLoading(false);
      return;
    }

    const fetchSensorData = async () => {
      try {
        const response = await fetch(`${API_BASE}/data`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Veri validasyonu
        const validatedData = {
          t: data.t || "--",
          h: data.h || "--",
          s: data.s || "Bağlantısız",
          f1: typeof data.f1 === "number" ? data.f1 : 0,
          f2: typeof data.f2 === "number" ? data.f2 : 0,
          frameTimestamp:
            data.frameTimestamp || new Date().toLocaleTimeString("tr-TR"),
        };

        setSensorData(validatedData);
        setLastDataUpdate(new Date());
        setError(null);
      } catch (err) {
        console.error("❌ Sensör hatası:", err.message);
        setError("Sensör verisi alınamadı: " + err.message);

        // Hata durumunda da fallback veri koy
        setSensorData((prev) => ({
          ...prev,
          s: "Bağlantısız",
        }));
      } finally {
        setLoading(false);
      }
    };

    // İlk çağrıyı hemen yap
    fetchSensorData();

    // Sonra 15 saniyede bir tekrarla
    const interval = setInterval(fetchSensorData, 15000);
    return () => clearInterval(interval);
  }, [isLoggedIn, token]);

  // ============= CANLI MOD DURUMU POLLING (5 saniye) =============
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const checkLiveModeStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/live-mode-status`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setLiveModeStatus(data);
        }
      } catch (err) {
        console.error("❌ Canlı mod durum hatası:", err);
      }
    };

    checkLiveModeStatus();
    const interval = setInterval(checkLiveModeStatus, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, token]);

  return {
    data: sensorData,
    loading,
    error,
    lastDataUpdate,
    liveModeStatus,
  };
};

// ============= CANLI MOD KONTROL FONKSİYONLARI =============

export const startLiveMode = async (token) => {
  try {
    const response = await fetch(
      `https://antares-backend.onrender.com/api/live-mode-start`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Canlı mod başlatılamadı");
    }

    console.log("✅ Canlı mod başlatıldı");
    return data;
  } catch (err) {
    console.error("❌ Canlı mod başlatma hatası:", err);
    throw err;
  }
};

export const stopLiveMode = async (token) => {
  try {
    const response = await fetch(
      `https://antares-backend.onrender.com/api/live-mode-stop`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Canlı mod durdurulamadı");
    }

    console.log("✅ Canlı mod durduruldu");
    return data;
  } catch (err) {
    console.error("❌ Canlı mod durdurma hatası:", err);
    throw err;
  }
};
