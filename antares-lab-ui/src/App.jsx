import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Thermometer,
  Droplets,
  Activity,
  Camera,
  Send,
  Power,
} from "lucide-react";

const API_BASE = "https://antares-backend.onrender.com/api"; // Render Backend Linkin

function App() {
  const [data, setData] = useState({
    t: "--",
    h: "--",
    s: "Ölçülüyor...",
    f1: 0,
    f2: 0,
  });
  const [lcdMsg, setLcdMsg] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pass, setPass] = useState("");

  // Canlı Telemetri Verisi Çekme (2 saniyede bir)
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      axios
        .get(`${API_BASE}/data`)
        .then((res) => setData(res.data))
        .catch((err) => console.error("Veri hatası:", err));
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  const handleLogin = () => {
    if (pass === "1234") setIsLoggedIn(true);
    else alert("Hatalı Giriş!");
  };

  const sendCommand = (cmd) => {
    axios.get(`${API_BASE}/cmd?${cmd}=toggle`);
  };

  const sendLcd = () => {
    axios.get(`${API_BASE}/msg?text=${encodeURIComponent(lcdMsg)}`);
    setLcdMsg("");
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-80 text-center">
          <h2 className="text-2xl font-bold text-cyan-500 mb-4">ANTARES</h2>
          <input
            type="password"
            className="w-full p-3 border-2 rounded-xl mb-4 outline-none focus:border-cyan-400"
            placeholder="Passcode"
            onChange={(e) => setPass(e.target.value)}
          />
          <button
            onClick={handleLogin}
            className="w-full bg-cyan-500 text-white p-3 rounded-xl font-bold"
          >
            Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 lg:p-10 font-sans">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-light">
            Antares{" "}
            <span className="font-bold text-cyan-500">Lab Interface</span>
          </h1>
          <p className="text-slate-400 text-sm italic">
            Artifact Protection System v2.0
          </p>
        </div>
        <div className="flex items-center gap-2 text-emerald-500 font-bold animate-pulse">
          <Activity size={20} /> SİSTEM ÇEVRİMİÇİ
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sol Kolon: Görsel Takip */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[30px] shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">
              Canlı Yayın & Dijital İkiz
            </span>
            <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-inner">
              <img
                src={`${API_BASE}/stream`}
                alt="Live Feed"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={() => axios.get(`${API_BASE}/capture`)}
              className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <Camera size={20} /> YENİ 360° TARAMA BAŞLAT
            </button>
          </div>
        </div>

        {/* Sağ Kolon: Telemetri & Kontrol */}
        <div className="space-y-6">
          {/* Telemetri Kartı */}
          <div className="bg-white p-6 rounded-[30px] shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">
              Anlık Telemetri
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-orange-50 rounded-2xl border-l-4 border-orange-400">
                <Thermometer className="text-orange-500 mb-2" size={24} />
                <span className="text-xs text-orange-700 font-bold">
                  Sıcaklık
                </span>
                <div className="text-2xl font-light">{data.t}°C</div>
              </div>
              <div className="p-4 bg-cyan-50 rounded-2xl border-l-4 border-cyan-400">
                <Droplets className="text-cyan-500 mb-2" size={24} />
                <span className="text-xs text-cyan-700 font-bold">Nem</span>
                <div className="text-2xl font-light">%{data.h}</div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border-l-4 border-emerald-500">
              <span className="text-xs text-emerald-700 font-bold block">
                Toprak Bağlamı (Referans)
              </span>
              <div className="text-lg font-medium text-emerald-900">
                {data.s}
              </div>
            </div>
          </div>

          {/* Donanım Kontrolü */}
          <div className="bg-white p-6 rounded-[30px] shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">
              Otonom Donanım Kontrolü
            </span>
            <div className="grid grid-cols-1 gap-3">
              <HardwareButton
                label="Salyangoz Fan"
                active={data.f1}
                onClick={() => sendCommand("fan1")}
              />
              <HardwareButton
                label="Düz Soğutma Fanı"
                active={data.f2}
                onClick={() => sendCommand("fan2")}
              />
            </div>
          </div>

          {/* Terminal Mesajı */}
          <div className="bg-white p-6 rounded-[30px] shadow-sm border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">
              LCD Terminal
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={lcdMsg}
                onChange={(e) => setLcdMsg(e.target.value)}
                className="flex-1 p-3 bg-slate-50 border rounded-xl outline-none focus:border-cyan-400 text-sm"
                placeholder="Mesaj yaz..."
              />
              <button
                onClick={sendLcd}
                className="bg-cyan-500 text-white p-3 rounded-xl hover:bg-cyan-600 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Yardımcı Alt Bileşen: Donanım Butonu
const HardwareButton = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full p-4 rounded-2xl flex justify-between items-center transition-all ${
      active
        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
        : "bg-slate-100 text-slate-500"
    }`}
  >
    <span className="font-bold text-sm">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase font-black">
        {active ? "AÇIK" : "KAPALI"}
      </span>
      <Power size={16} />
    </div>
  </button>
);

export default App;
