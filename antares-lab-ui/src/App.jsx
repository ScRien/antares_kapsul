import React, { useState, useEffect } from "react";
import axios from "axios";

// API_BASE sonundaki /api kısmını sildik, çünkü backend direkt kök dizinden çalışıyor
const API_BASE = "https://antares-backend.onrender.com";

function App() {
  const [data, setData] = useState({
    t: "--",
    h: "--",
    s: "Ölçülüyor...",
    f1: 0,
    f2: 0,
  });
  const [lcdMsg, setLcdMsg] = useState("");
  const [passInput, setPassInput] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Veri Çekme (Endpoint: /data)
  useEffect(() => {
    const interval = setInterval(() => {
      axios
        .get(`${API_BASE}/data`)
        .then((res) => {
          // Eğer gelen veri bir nesne ise state'i güncelle
          if (res.data && typeof res.data === "object") {
            setData(res.data);
          }
        })
        .catch((err) => console.log("Veri yolu hatalı veya sunucu kapalı."));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const checkLogin = () => {
    if (passInput === "1234") setIsLoggedIn(true);
    else alert("Hatalı Giriş!");
  };

  // Donanım Kontrolü (Endpoint: /cmd?fanX=ON/OFF)
  const toggleHardware = (type) => {
    // Mevcut duruma göre tam tersini gönder (1 ise OFF, 0 ise ON)
    const currentState = type === "fan1" ? data.f1 : data.f2;
    const val = currentState === 1 ? "OFF" : "ON";

    axios
      .get(`${API_BASE}/cmd?${type}=${val}`)
      .then(() => {
        console.log(`${type} komutu gönderildi: ${val}`);
      })
      .catch((err) => console.error("Komut hatası:", err));
  };

  // LCD Mesaj (Endpoint: /msg?text=...)
  const sendLcdMsg = () => {
    axios.get(`${API_BASE}/msg?text=${encodeURIComponent(lcdMsg)}`).then(() => {
      alert("LCD'ye iletildi!");
      setLcdMsg("");
    });
  };

  // Tarama (Endpoint: /capture)
  const triggerScan = () => {
    axios
      .get(`${API_BASE}/capture`)
      .then(() => alert("Tarama Komutu Gönderildi."));
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] font-sans text-[#2d3436]">
      {/* LOGIN OVERLAY (Aynen Korundu) */}
      <div
        className={`fixed inset-0 bg-white z-[9999] flex items-center justify-center transition-transform duration-[800ms] ease-[cubic-bezier(0.85,0,0.15,1)] ${isLoggedIn ? "-translate-y-full" : "translate-y-0"}`}
      >
        <div className="text-center p-10 max-w-[350px] w-[90%]">
          <h2 className="text-[#00d2ff] text-3xl font-bold mb-2 tracking-tighter">
            ANTARES
          </h2>
          <p className="mb-6 text-slate-500 text-sm">
            Artifact Protection System Login
          </p>
          <input
            type="password"
            placeholder="Passcode"
            className="w-full p-3 border-2 border-slate-100 rounded-xl mb-4 outline-none focus:border-[#00d2ff] text-center"
            onChange={(e) => setPassInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && checkLogin()}
          />
          <button
            onClick={checkLogin}
            className="w-full bg-[#00d2ff] text-white p-4 rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all"
          >
            GİRİŞ YAP
          </button>
        </div>
      </div>

      {/* HEADER */}
      <header className="bg-white px-10 py-4 shadow-sm flex justify-between items-center">
        <h2 className="text-xl font-bold m-0">
          Antares{" "}
          <span className="font-light text-slate-400">Lab Interface</span>
        </h2>
        <div className="text-[#10ac84] font-bold animate-pulse flex items-center gap-2 text-sm uppercase tracking-widest">
          <span className="text-lg">●</span> SİSTEM ÇEVRİMİÇİ
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-[1300px] mx-auto my-5 px-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 pb-10">
        {/* Sol Taraf: Görseller */}
        <section className="space-y-6">
          <div className="bg-white p-5 rounded-[20px] shadow-sm">
            <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-4 block">
              Canlı Yayın (Dijital İkiz)
            </span>
            <div className="w-full h-[450px] bg-[#111] rounded-2xl overflow-hidden">
              <img
                src={`${API_BASE}/stream`}
                alt="Live Feed"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] shadow-sm">
            <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-4 block">
              360° Tarama Arşivi
            </span>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-[120px] h-[90px] bg-[#f9f9f9] border-2 border-dashed border-[#eee] rounded-xl flex-shrink-0 flex items-center justify-center text-[#ccc] text-[10px] hover:border-[#00d2ff] transition-all cursor-pointer"
                >
                  FOTO {i}
                </div>
              ))}
            </div>
            <button
              onClick={triggerScan}
              className="w-full mt-2 bg-[#10ac84] text-white p-4 rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all uppercase text-sm tracking-widest"
            >
              Yeni 360° Tarama Başlat
            </button>
          </div>
        </section>

        {/* Sağ Taraf: Kontroller */}
        <section className="space-y-6">
          {/* Telemetri */}
          <div className="bg-white p-6 rounded-[20px] shadow-sm">
            <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-6 block">
              Anlık Telemetri
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border-l-4 border-[#ff9f43] rounded-r-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  Sıcaklık
                </span>
                <span className="text-3xl font-light block mt-1">
                  {data.t}
                  <small className="text-sm">°C</small>
                </span>
              </div>
              <div className="p-4 bg-slate-50 border-l-4 border-[#00d2ff] rounded-r-xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  Nem
                </span>
                <span className="text-3xl font-light block mt-1">
                  %{data.h}
                </span>
              </div>
            </div>
            <div className="mt-4 p-4 bg-slate-50 border-l-4 border-[#10ac84] rounded-r-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase">
                Toprak Bağlamı
              </span>
              <span className="text-lg font-semibold block mt-1 text-[#10ac84]">
                {data.s}
              </span>
            </div>
          </div>

          {/* Donanım Butonları */}
          <div className="bg-white p-6 rounded-[20px] shadow-sm">
            <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-6 block">
              Donanım Kontrolü
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#fcfcfc] p-4 rounded-2xl border border-[#f0f0f0] text-center">
                <span className="text-[10px] font-bold text-slate-400 block mb-3 uppercase">
                  Salyangoz
                </span>
                <button
                  onClick={() => toggleHardware("fan1")}
                  className={`w-full py-3 rounded-xl font-black text-xs transition-all ${data.f1 === 1 ? "bg-[#10ac84] text-white shadow-lg shadow-green-100" : "bg-[#eee] text-slate-400"}`}
                >
                  {data.f1 === 1 ? "AÇIK" : "KAPALI"}
                </button>
              </div>
              <div className="bg-[#fcfcfc] p-4 rounded-2xl border border-[#f0f0f0] text-center">
                <span className="text-[10px] font-bold text-slate-400 block mb-3 uppercase">
                  Düz Fan
                </span>
                <button
                  onClick={() => toggleHardware("fan2")}
                  className={`w-full py-3 rounded-xl font-black text-xs transition-all ${data.f2 === 1 ? "bg-[#10ac84] text-white shadow-lg shadow-green-100" : "bg-[#eee] text-slate-400"}`}
                >
                  {data.f2 === 1 ? "AÇIK" : "KAPALI"}
                </button>
              </div>
            </div>
          </div>

          {/* LCD Terminal */}
          <div className="bg-white p-6 rounded-[20px] shadow-sm">
            <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-6 block">
              LCD Terminal Mesajı
            </span>
            <input
              type="text"
              placeholder="Ekrana yazılacak mesaj..."
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl mb-4 outline-none focus:border-[#00d2ff] text-sm"
              value={lcdMsg}
              onChange={(e) => setLcdMsg(e.target.value)}
            />
            <button
              onClick={sendLcdMsg}
              className="w-full bg-[#00d2ff] text-white p-4 rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all text-sm tracking-widest uppercase"
            >
              Mesajı Gönder
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
