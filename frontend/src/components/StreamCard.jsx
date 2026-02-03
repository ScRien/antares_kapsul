import React, { useState, useEffect } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";
// const API_BASE = "http://localhost:3000/api"; // Local dev

export default function StreamCard({ token }) {
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
  const [error, setError] = useState(null);

  // Check initial live status
  useEffect(() => {
    if (!token) return;

    const checkInitialLiveStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/live-mode-status`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.active) {
            setIsLiveMode(true);
            setRemainingTime(300);
            setQueueStats(data.queueStats);
          }
        }
      } catch (err) {
        console.error("Baslangic live mod durumu kontrol hatasi:", err);
      }
    };

    checkInitialLiveStatus();
  }, [token]);

  // Live mode timer (5 minutes = 300 seconds)
  useEffect(() => {
    if (!isLiveMode) return;

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          handleStopLiveBackend();
          setIsLiveMode(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLiveMode]);

  // Status check (5 seconds)
  useEffect(() => {
    if (!isLiveMode || !token) return;

    const statusCheck = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/live-mode-status`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) throw new Error("Durum kontrol basarisiz");

        const data = await response.json();

        if (data.active) {
          setQueueStats(data.queueStats || queueStats);
        } else {
          setIsLiveMode(false);
          setRemainingTime(0);
        }
      } catch (err) {
        console.error("Durum kontrol hatasi:", err);
      }
    }, 5000);

    return () => clearInterval(statusCheck);
  }, [isLiveMode, token]);

  // Fetch metadata
  useEffect(() => {
    if (!token) return;

    const fetchMetadata = async () => {
      try {
        const response = await fetch(`${API_BASE}/data`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) throw new Error("Metadata alinamadi");

        const data = await response.json();
        if (data.frameTimestamp) {
          setFrameTime(data.frameTimestamp);
          setError(null);
        }
      } catch (err) {
        console.error("Frame metadata hatasi:", err);
        setError("Metadata alinamadi");
      }
    };

    fetchMetadata();
  }, [lastCapture, token]);

  // Start live mode
  const handleStartLive = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/live-mode-start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setIsLiveMode(true);
        setRemainingTime(300);
        setQueueStats(
          data.queueStats || { total: 0, pending: 0, sent: 0, acked: 0 },
        );
        console.log("Live mod basladi! 5 dakika");
      } else {
        const errorMsg = data.message || "Live mod baslatılamadi";
        console.error("Live mod baslatılamadi:", errorMsg);
        setError(errorMsg);
        alert("Live mod baslatılamadi: " + errorMsg);
      }
    } catch (err) {
      console.error("Hata:", err.message);
      setError(err.message);
      alert("Baglanti hatasi! " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Stop live mode
  const handleStopLive = async () => {
    console.log("Live mod durdurulu...");
    await handleStopLiveBackend();
    setIsLiveMode(false);
    setRemainingTime(0);
    setError(null);
  };

  // Send stop to backend
  const handleStopLiveBackend = async () => {
    try {
      const response = await fetch(`${API_BASE}/live-mode-stop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Durdurma basarisiz");

      const data = await response.json();
      if (data.success) {
        console.log("Live mod durduruldu");
      } else {
        console.error("Backend durdurma hatasi:", data.message);
      }
    } catch (err) {
      console.error("Durdurma hatasi:", err);
    }
  };

  // Format remaining time
  const formatRemainingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white p-5 rounded-[20px] shadow-sm">
      {/* BASLIK */}
      <div className="flex justify-between items-center mb-4 border-b border-[#f0f0f0] pb-2">
        <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px]">
          Canli Yayin (Dijital Ikiz)
        </span>
        <div className="flex items-center gap-2">
          {isLiveMode && (
            <span className="text-[0.65rem] text-[#ff6b6b] font-bold animate-pulse">
              CANLI - {formatRemainingTime(remainingTime)}
            </span>
          )}
          {frameTime && !isLiveMode && (
            <span className="text-[0.65rem] text-[#00d2ff] font-bold">
              {frameTime}
            </span>
          )}
          {!frameTime && (
            <span className="text-[0.65rem] text-[#aaa] font-bold">
              Beklemede...
            </span>
          )}
        </div>
      </div>

      {/* HATA MESAJI */}
      {error && (
        <div className="mb-3 p-2 bg-red-50 border-l-2 border-red-400 rounded text-xs text-red-600">
          {error}
        </div>
      )}

      {/* GORUNTU */}
      <div className="w-full h-[450px] bg-[#111] rounded-2xl overflow-hidden relative mb-3">
        <img
          src={`${API_BASE}/stream?t=${lastCapture.getTime()}`}
          alt="Live Feed"
          className="w-full h-full object-contain"
          onLoad={() => {
            console.log("Frame ekrana yuklendi");
            setLastCapture(new Date());
          }}
          onError={() => {
            console.error("Frame yukleme hatasi");
            setError("Frame yuklenemedi");
          }}
        />

        {/* DURUM GOSTERGESI */}
        <div className="absolute top-2 right-2 bg-[#00d2ff] text-white text-[10px] px-2 py-1 rounded font-bold">
          {loading ? "Cekiliyor..." : isLiveMode ? "CANLI" : "Hazir"}
        </div>

        {/* QUEUE SAYACI */}
        {isLiveMode && (
          <div className="absolute bottom-2 right-2 bg-[#ff6b6b] text-white text-[10px] px-2 py-1 rounded font-bold">
            {queueStats.pending} pending
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
            {loading ? "Cekiliyor..." : "Canli Goruntuyu Al (5 dk)"}
          </button>
        ) : (
          <button
            onClick={handleStopLive}
            className="w-full bg-[#ff6b6b] hover:bg-[#ff5252] text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95"
          >
            Canli Modu Durdur
          </button>
        )}
      </div>

      {/* BILGI NOTU */}
      {isLiveMode && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-gray-600">
          <p>
            Canli mod 5 dakika boyunca her 10 saniyede goruntuyu yenilenecektir.
          </p>
          <p className="mt-1">Beklenen: ~30 istek (5 dakika 10 saniye)</p>
          <p className="mt-1 text-gray-500">
            Pending: {queueStats.pending} | Gonderilen: {queueStats.sent} |
            Onaylanan: {queueStats.acked}
          </p>
        </div>
      )}
    </div>
  );
}
