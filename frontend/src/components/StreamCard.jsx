import React, { useState, useEffect } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";

export default function StreamCard() {
  const [frameTime, setFrameTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastCapture, setLastCapture] = useState(new Date());
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  // Canlı mod zamanlayıcısı (5 dakika = 300 saniye)
  useEffect(() => {
    if (!isLiveMode) return;

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          setIsLiveMode(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLiveMode]);

  // 10 saniyede bir canlı görüntü yenile (canlı mod aktifse)
  useEffect(() => {
    if (!isLiveMode) return;

    const autoRefresh = setInterval(() => {
      handleCaptureLive(true); // otomatik çekme için flag
    }, 10000); // 10 saniye

    return () => clearInterval(autoRefresh);
  }, [isLiveMode]);

  // Metadata güncelle
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`${API_BASE}/data`);
        const data = await res.json();
        if (data.frameTimestamp) {
          setFrameTime(data.frameTimestamp);
        }
      } catch (err) {
        console.error("Frame metadata hatası:", err);
      }
    };

    fetchMetadata();
  }, [lastCapture]);

  // Canlı görüntü al
  const handleCaptureLive = async (isAuto = false) => {
    if (!isAuto) {
      setLoading(true);
      setIsLiveMode(true);
      setRemainingTime(300); // 5 dakika
    }

    console.log(
      isAuto
        ? "🔄 Otomatik canlı görüntü yenileniyor..."
        : "📸 Canlı kare çekiliyor...",
    );

    try {
      const response = await fetch(`${API_BASE}/capture-live`, {
        method: "GET",
      });

      if (response.ok) {
        // 2-3 saniye bekle (ESP32'nin çekip göndermesi için)
        await new Promise((resolve) => setTimeout(resolve, 2500));

        // Sonra metadata güncelle
        setLastCapture(new Date());
        console.log("✅ Frame alındı!");
      }
    } catch (err) {
      console.error("❌ Frame çekme hatası:", err);
    } finally {
      if (!isAuto) {
        setLoading(false);
      }
    }
  };

  // Canlı modu durdur
  const handleStopLive = () => {
    setIsLiveMode(false);
    setRemainingTime(0);
  };

  const formatRemainingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white p-5 rounded-[20px] shadow-sm">
      <div className="flex justify-between items-center mb-4 border-b border-[#f0f0f0] pb-2">
        <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px]">
          Canli Yayin (Dijital Ikiz)
        </span>
        <div className="flex items-center gap-2">
          {isLiveMode && (
            <span className="text-[0.65rem] text-[#ff6b6b] font-bold animate-pulse">
              ● CANLI - {formatRemainingTime(remainingTime)}
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

      <div className="w-full h-[450px] bg-[#111] rounded-2xl overflow-hidden relative mb-3">
        <img
          src={`${API_BASE}/stream?t=${lastCapture.getTime()}`}
          alt="Live Feed"
          className="w-full h-full object-contain"
          onLoad={() => console.log("✅ Frame ekrana yüklendi")}
          onError={() => console.error("❌ Frame yükleme hatası")}
        />

        {/* Status göstergesi */}
        <div className="absolute top-2 right-2 bg-[#00d2ff] text-white text-[10px] px-2 py-1 rounded">
          {loading ? "⏳ Çekiliyor..." : isLiveMode ? "CANLI 🔴" : "Hazır 🟢"}
        </div>
      </div>

      {/* Butonlar */}
      <div className="space-y-2">
        {!isLiveMode ? (
          <button
            onClick={() => handleCaptureLive(false)}
            disabled={loading}
            className="w-full bg-[#00d2ff] hover:bg-[#0099cc] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95"
          >
            {loading ? "⏳ Çekiliyor..." : "📸 Canli Goruntuyu Al (5 dk)"}
          </button>
        ) : (
          <button
            onClick={handleStopLive}
            className="w-full bg-[#ff6b6b] hover:bg-[#ff5252] text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95"
          >
            ⏹ Canli Modu Durdur
          </button>
        )}
      </div>

      {/* Bilgi notu */}
      {isLiveMode && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-gray-600">
          <p>
            📌 Canlı mod 5 dakika boyunca her 10 saniyede görüntü
            yenilenecektir.
          </p>
          <p className="mt-1">Bkz: ~30 istek (5 dakika / 10 saniye)</p>
        </div>
      )}
    </div>
  );
}
