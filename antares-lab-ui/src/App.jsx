import React, { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "https://antares-backend.onrender.com/api";

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

  // ✅ v2: Loading states ve command feedback
  const [f1Loading, setF1Loading] = useState(false);
  const [f2Loading, setF2Loading] = useState(false);
  const [commandStatus, setCommandStatus] = useState("");
  const [lastDataUpdate, setLastDataUpdate] = useState(new Date());

  useEffect(() => {
    const client = axios.create({
      baseURL: API_BASE,
      timeout: 8000,
    });

    const fetchData = async () => {
      try {
        const res = await client.get("/data");
        if (res.data && typeof res.data === "object") {
          setData(res.data);
          setLastDataUpdate(new Date());
        }
      } catch (e) {
        // Sessiz başarısız (Render sunucu uyuyor olabilir)
      }
    };

    // ✅ v2: İlk açılışta 1 kere çek
    fetchData();

    // ✅ v2: 2 saniyede bir veri çek (1 saniye hızlanabilir)
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const checkLogin = () => {
    if (passInput === "1234") setIsLoggedIn(true);
    else alert("Hatalı Giriş!");
  };

  // ✅ v2: toggleHardware - İyimser + Rollback
  const toggleHardware = (type) => {
    const isCurrentlyOn = type === "fan1" ? data.f1 === 1 : data.f2 === 1;
    const newValue = isCurrentlyOn ? "OFF" : "ON";
    const newIntVal = isCurrentlyOn ? 0 : 1;

    // Loading state başlat
    if (type === "fan1") setF1Loading(true);
    else setF2Loading(true);

    // ✅ İyimser güncelleme
    const oldValue = type === "fan1" ? data.f1 : data.f2;
    setData((prev) => ({
      ...prev,
      [type === "fan1" ? "f1" : "f2"]: newIntVal,
    }));

    setCommandStatus(`⏳ ${type} komutu gönderiliyor...`);

    // Backend'e gönder
    axios
      .get(`${API_BASE}/cmd`, {
        params: { [type]: newValue },
      })
      .then((response) => {
        console.log(`✅ ${type} başarıyla ${newValue} yapıldı.`);

        // ✅ Backend state'ini al
        if (response.data.hardwareState) {
          const stateKey = type === "fan1" ? "f1" : "f2";
          setData((prev) => ({
            ...prev,
            [stateKey]: response.data.hardwareState[stateKey] ?? newIntVal,
          }));
        }

        setCommandStatus(`✅ ${type} komutu başarılı`);
        setTimeout(() => setCommandStatus(""), 3000);
      })
      .catch((err) => {
        console.error("Komut hatası:", err);

        // ✅ Rollback: Hata olursa eski state'e dön
        setData((prev) => ({
          ...prev,
          [type === "fan1" ? "f1" : "f2"]: oldValue,
        }));

        setCommandStatus(`❌ ${type} komutu başarısız - Ağ hatası`);
        alert("Komut gönderilemedi! Ağ bağlantınızı kontrol edin.");

        setTimeout(() => setCommandStatus(""), 5000);
      })
      .finally(() => {
        if (type === "fan1") setF1Loading(false);
        else setF2Loading(false);
      });
  };

  const sendLcdMsg = () => {
    if (!lcdMsg.trim()) {
      alert("Lütfen bir mesaj yazın!");
      return;
    }

    setCommandStatus("⏳ LCD mesajı gönderiliyor...");

    axios
      .get(`${API_BASE}/msg`, { params: { text: lcdMsg } })
      .then(() => {
        alert("✅ LCD'ye iletildi!");
        setLcdMsg("");
        setCommandStatus("✅ LCD mesajı gönderildi");
        setTimeout(() => setCommandStatus(""), 3000);
      })
      .catch((err) => {
        console.error("LCD msg hatası:", err);
        alert("❌ Mesaj gönderilemedi!");
        setCommandStatus("❌ LCD mesajı gönderilemedi");
        setTimeout(() => setCommandStatus(""), 5000);
      });
  };

  const triggerScan = () => {
    setCommandStatus("⏳ Tarama komutu gönderiliyor...");

    axios
      .get(`${API_BASE}/capture`)
      .then(() => {
        alert("✅ Tarama Komutu Gönderildi.");
        setCommandStatus("✅ 360° Tarama başlatıldı");
        setTimeout(() => setCommandStatus(""), 3000);
      })
      .catch((err) => {
        console.error("Capture hatası:", err);
        alert("❌ Tarama komutu gönderilemedi!");
        setCommandStatus("❌ Tarama başlatılamadı");
        setTimeout(() => setCommandStatus(""), 5000);
      });
  };

  const getStatusColor = () => {
    if (commandStatus.includes("⏳")) return "bg-yellow-50 border-yellow-200";
    if (commandStatus.includes("✅")) return "bg-green-50 border-green-200";
    if (commandStatus.includes("❌")) return "bg-red-50 border-red-200";
    return "bg-white border-gray-200";
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] font-sans text-[#2d3436]">
      {/* Login Overlay */}
      <div
        className={`fixed inset-0 bg-white z-[9999] flex items-center justify-center transition-transform duration-[800ms] ease-[cubic-bezier(0.85,0,0.15,1)] ${
          isLoggedIn ? "-translate-y-full" : "translate-y-0"
        }`}
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
          <div style={{ opacity: 0.6, marginTop: 8, fontSize: 12 }}>
            Varsayılan: 1234
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white px-10 py-4 shadow-sm flex justify-between items-center">
        <h2 className="text-xl font-bold m-0">
          Antares{" "}
          <span className="font-light text-slate-400">Lab Interface v2</span>
        </h2>
        <div className="flex items-center gap-4">
          <div className="text-[#10ac84] font-bold animate-pulse flex items-center gap-2 text-sm uppercase tracking-widest">
            <span className="text-lg">●</span> SİSTEM ÇEVRİMİÇİ
          </div>
          <div className="text-[10px] text-slate-400">
            Son güncelleme: {lastDataUpdate.toLocaleTimeString("tr-TR")}
          </div>
        </div>
      </header>

      {/* Command Status Indicator */}
      {commandStatus && (
        <div
          className={`fixed top-20 right-5 shadow-lg p-4 rounded-lg text-sm font-medium z-50 max-w-xs border-2 ${getStatusColor()} transition-all`}
        >
          {commandStatus}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[1300px] mx-auto my-5 px-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 pb-10">
        {/* Left Column - Visual */}
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

        {/* Right Column - Controls */}
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

          {/* Donanım Kontrolü */}
          <div className="bg-white p-6 rounded-[20px] shadow-sm">
            <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-6 block">
              Donanım Kontrolü (v2: Real-time)
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#fcfcfc] p-4 rounded-2xl border border-[#f0f0f0] text-center">
                <span className="text-[10px] font-bold text-slate-400 block mb-3 uppercase">
                  Salyangoz (F1)
                </span>
                <button
                  onClick={() => toggleHardware("fan1")}
                  disabled={f1Loading}
                  className={`w-full py-3 rounded-xl font-black text-xs transition-all ${
                    data.f1 === 1
                      ? "bg-[#10ac84] text-white shadow-lg shadow-green-100"
                      : "bg-[#eee] text-slate-400"
                  } ${f1Loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {f1Loading ? "⏳..." : data.f1 === 1 ? "AÇIK" : "KAPALI"}
                </button>
              </div>

              <div className="bg-[#fcfcfc] p-4 rounded-2xl border border-[#f0f0f0] text-center">
                <span className="text-[10px] font-bold text-slate-400 block mb-3 uppercase">
                  Düz Fan (F2)
                </span>
                <button
                  onClick={() => toggleHardware("fan2")}
                  disabled={f2Loading}
                  className={`w-full py-3 rounded-xl font-black text-xs transition-all ${
                    data.f2 === 1
                      ? "bg-[#10ac84] text-white shadow-lg shadow-green-100"
                      : "bg-[#eee] text-slate-400"
                  } ${f2Loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {f2Loading ? "⏳..." : data.f2 === 1 ? "AÇIK" : "KAPALI"}
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
              onKeyDown={(e) => e.key === "Enter" && sendLcdMsg()}
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
