import React, { useState, useEffect } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";

export default function StreamCard() {
  const [frameTime, setFrameTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastCapture, setLastCapture] = useState(new Date());
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [queueStats, setQueueStats] = useState({
    total: 0,
    pending: 0,
    sent: 0,
    acked: 0,
  });

  // ============= CANLΙ MOD ZAMANLAYICISI (5 dakika = 300 saniye) =============
  useEffect(() => {
    if (!isLiveMode) return;

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          // Mod otomatik biterse, backend'e durdur mesajı gönder
          handleStopLiveBackend();
          setIsLiveMode(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLiveMode]);

  // ============= DURUM KONTROL (5 saniyede bir) =============
  // Backend'den canlı mod durumunu ve queue istatistiklerini kontrol et
  useEffect(() => {
    if (!isLiveMode) return;

    const statusCheck = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/live-mode-status`);
        const data = await res.json();

        if (data.active) {
          setQueueStats(data.queueStats);
        } else {
          // Eğer backend'de mod inaktif ise, frontend'i de durdur
          setIsLiveMode(false);
          setRemainingTime(0);
        }
      } catch (err) {
        console.error("❌ Durum kontrol hatası:", err);
      }
    }, 5000); // 5 saniye

    return () => clearInterval(statusCheck);
  }, [isLiveMode]);

  // ============= METADATA GÜNCELLEME =============
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`${API_BASE}/data`);
        const data = await res.json();
        if (data.frameTimestamp) {
          setFrameTime(data.frameTimestamp);
        }
      } catch (err) {
        console.error("❌ Frame metadata hatası:", err);
      }
    };

    fetchMetadata();
  }, [lastCapture]);

  // ============= CANLΙ MODU BAŞLAT =============
  const handleStartLive = async () => {
    setLoading(true);
    console.log("🟢 Canlı mod başlatılıyor...");

    try {
      const res = await fetch(`${API_BASE}/live-mode-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.success) {
        setIsLiveMode(true);
        setRemainingTime(300); // 5 dakika = 300 saniye
        setQueueStats({ total: 0, pending: 0, sent: 0, acked: 0 });
        console.log("✅ Canlı mod başladı! 5 dakika (≈30 frame)");
      } else {
        console.error("❌ Canlı mod başlatılamadı:", data.message);
        alert("Canlı mod başlatılamadı: " + data.message);
      }
    } catch (err) {
      console.error("❌ Hata:", err);
      alert("Bağlantı hatası!");
    } finally {
      setLoading(false);
    }
  };

  // ============= CANLΙ MODU DURDUR (Manual) =============
  const handleStopLive = async () => {
    console.log("⏹ Canlı mod durdurulüyor...");
    await handleStopLiveBackend();
    setIsLiveMode(false);
    setRemainingTime(0);
  };

  // ============= BACKEND'E DURDUR GÖNDERİ =============
  const handleStopLiveBackend = async () => {
    try {
      const res = await fetch(`${API_BASE}/live-mode-stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.success) {
        console.log("✅ Canlı mod durdu");
      } else {
        console.error("Backend'de durdurma hatası:", data.message);
      }
    } catch (err) {
      console.error("❌ Durdurma hatası:", err);
    }
  };

  // ============= KALANLANTTI ZAMANI FORMATLA =============
  const formatRemainingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white p-5 rounded-[20px] shadow-sm">
      {/* BAŞLIK */}
      <div className="flex justify-between items-center mb-4 border-b border-[#f0f0f0] pb-2">
        <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px]">
          Canlı Yayın (Dijital İkiz)
        </span>
        <div className="flex items-center gap-2">
          {isLiveMode && (
            <span className="text-[0.65rem] text-[#ff6b6b] font-bold animate-pulse">
              🔴 CANLΙ - {formatRemainingTime(remainingTime)}
            </span>
          )}
          {frameTime && !isLiveMode && (
            <span className="text-[0.65rem] text-[#00d2ff] font-bold">
              📸 {frameTime}
            </span>
          )}
          {!frameTime && (
            <span className="text-[0.65rem] text-[#aaa] font-bold">
              ⏳ Beklemede...
            </span>
          )}
        </div>
      </div>

      {/* VİDEO ÇERÇEVE */}
      <div className="w-full h-[450px] bg-[#111] rounded-2xl overflow-hidden relative mb-3">
        <img
          src={`${API_BASE}/stream?t=${lastCapture.getTime()}`}
          alt="Live Feed"
          className="w-full h-full object-contain"
          onLoad={() => console.log("✅ Frame ekrana yüklendi")}
          onError={() => console.error("❌ Frame yükleme hatası")}
        />

        {/* DURUM GÖSTERGESİ */}
        <div className="absolute top-2 right-2 bg-[#00d2ff] text-white text-[10px] px-2 py-1 rounded font-bold">
          {loading ? "⏳ Çekiliyor..." : isLiveMode ? "CANLΙ 🔴" : "Hazır 🟢"}
        </div>

        {/* QUEUE SAYACI (Canlı mod aktifse) */}
        {isLiveMode && (
          <div className="absolute bottom-2 right-2 bg-[#ff6b6b] text-white text-[10px] px-2 py-1 rounded font-bold">
            📦 {queueStats.pending} pending
          </div>
        )}
      </div>

      {/* BUTONLAR */}
      <div className="space-y-2">
        {!isLiveMode ? (
          <button
            onClick={handleStartLive}
            disabled={loading}
            className="w-full bg-[#00d2ff] hover:bg-[#0099cc] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95"
          >
            {loading ? "⏳ Çekiliyor..." : "📸 Canlı Görüntüyü Al (5 dk)"}
          </button>
        ) : (
          <button
            onClick={handleStopLive}
            className="w-full bg-[#ff6b6b] hover:bg-[#ff5252] text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95"
          >
            ⏹ Canlı Modu Durdur
          </button>
        )}
      </div>

      {/* BİLGİ NOTU */}
      {isLiveMode && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-gray-600">
          <p>
            📌 Canlı mod 5 dakika boyunca her 10 saniyede görüntü
            yenilenecektir.
          </p>
          <p className="mt-1">Beklenen: ~30 istek (5 dakika ÷ 10 saniye)</p>
          <p className="mt-1 text-gray-500">
            Pending: {queueStats.pending} | Gönderilen: {queueStats.sent} |
            Onaylanan: {queueStats.acked}
          </p>
        </div>
      )}
    </div>
  );
}
