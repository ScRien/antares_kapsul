import React, { useState, useEffect } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";

export default function StreamCard() {
  const [frameTime, setFrameTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastCapture, setLastCapture] = useState(new Date());

  // 🔴 BURADA ARTIK setInterval YOK!
  // Sadece buton tıklandığında çek

  // ✅ Metadata güncelle (optional, isterseniz)
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
  }, [lastCapture]); // lastCapture değişince metadata çek

  // ✅ Buton: Şimdi çekver
  const handleCaptureLive = async () => {
    setLoading(true);
    console.log("📸 Canlı kare çekiliyor...");

    try {
      // Backend'e "ŞIMDI ÇEK" komutu gönder
      const response = await fetch(`${API_BASE}/capture-live`, {
        method: "GET",
      });

      if (response.ok) {
        // 2-3 saniye bekle (ESP32'nin çekip göndermesi için)
        await new Promise((resolve) => setTimeout(resolve, 2500));

        // Sonra metadata güncelle (frameTimestamp değişecek)
        setLastCapture(new Date());
        console.log("✅ Frame alındı!");
      }
    } catch (err) {
      console.error("❌ Frame çekme hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-[20px] shadow-sm">
      <div className="flex justify-between items-center mb-4 border-b border-[#f0f0f0] pb-2">
        <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px]">
          Canlı Yayın (Dijital İkiz)
        </span>
        <span className="text-[0.65rem] text-[#00d2ff] font-bold">
          {frameTime ? `📸 ${frameTime}` : "⏳ Beklemede..."}
        </span>
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
          {loading ? "⏳ Çekiliyor..." : "Canlı 🔴"}
        </div>
      </div>

      {/* ✅ BUTON: Canlı görüntü al */}
      <button
        onClick={handleCaptureLive}
        disabled={loading}
        className="w-full bg-[#00d2ff] hover:bg-[#0099cc] disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95"
      >
        {loading ? "⏳ Çekiliyor..." : "📸 Canlı Görüntü Al"}
      </button>
    </div>
  );
}
