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

  // ✅ YENİ: 360° Arşiv states
  const [archiveFiles, setArchiveFiles] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [selectedScan, setSelectedScan] = useState(null);
  const [viewerActive, setViewerActive] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [scanImages, setScanImages] = useState([]);

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

  // ✅ YENİ: Arşiv dosyalarını yükle
  const loadArchiveFiles = async () => {
    setArchiveLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/archive/list`);
      if (res.data.files) {
        setArchiveFiles(res.data.files);
        console.log(`✅ ${res.data.count} dosya yüklendi`);
      }
    } catch (e) {
      console.error("❌ Arşiv yükleme hatası:", e.message);
      alert("Arşiv yüklenemedi!");
    } finally {
      setArchiveLoading(false);
    }
  };

  // ✅ YENİ: Taramayı 360 oynatıcıda aç
  const openScan360 = async (fileName) => {
    // Tarama ID'sini dosya adından çıkar (ilk 15 karakter)
    const scanId = fileName.substring(0, 15);

    // Bu taramaya ait tüm dosyaları bul
    const scanFilesArray = archiveFiles.filter((f) =>
      f.name.startsWith(scanId),
    );

    if (scanFilesArray.length === 0) {
      alert("Bu taramaya ait görüntü bulunamadı!");
      return;
    }

    setScanImages(scanFilesArray);
    setSelectedScan({
      id: scanId,
      timestamp: scanFilesArray[0].timestamp,
      count: scanFilesArray.length,
    });
    setCurrentImageIndex(0);
    setViewerActive(true);

    console.log(`🎬 360° Oynatıcı açıldı: ${scanFilesArray.length} görüntü`);
  };

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

    // ✅ v3: Karakter sınırı kontrolü (LCD 20 karakter)
    if (lcdMsg.length > 20) {
      alert(
        "❌ LCD maksimum 20 karaktere kadar destekler!\n(Şu an: " +
          lcdMsg.length +
          " karakter)",
      );
      return;
    }

    setCommandStatus("⏳ LCD mesajı gönderiliyor...");

    // ✅ v3: Endpoint düzeltildi (/api/cmd?msg=... şeklinde)
    axios
      .get(`${API_BASE}/cmd`, { params: { msg: lcdMsg } })
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

  // ✅ YENİ: 360° Oynatıcı kontrolü
  const handlePrevImage = () => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? scanImages.length - 1 : prev - 1,
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) =>
      prev === scanImages.length - 1 ? 0 : prev + 1,
    );
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

      {/* ✅ YENİ: 360° Viewer Modal */}
      {viewerActive && selectedScan && (
        <div className="fixed inset-0 bg-black/90 z-[10000] flex flex-col items-center justify-center p-4">
          {/* Başlık */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold">
                  360° Tarama Görüntüleyicisi
                </h3>
                <p className="text-sm text-gray-300 mt-1">
                  Tarih: {selectedScan.timestamp} | Toplam: {selectedScan.count}{" "}
                  görüntü
                </p>
              </div>
              <button
                onClick={() => setViewerActive(false)}
                className="text-white text-3xl font-bold hover:text-gray-400"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Ana görüntü */}
          <div className="relative w-full h-full flex items-center justify-center">
            {scanImages.length > 0 && (
              <img
                key={scanImages[currentImageIndex].name}
                src={`${API_BASE}/archive/file?name=${encodeURIComponent(
                  scanImages[currentImageIndex].name,
                )}`}
                alt={`Görüntü ${currentImageIndex + 1}`}
                className="max-w-[90%] max-h-[85%] object-contain"
              />
            )}
          </div>

          {/* Alt kontroller */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
            <div className="flex items-center justify-center gap-8 mb-4">
              <button
                onClick={handlePrevImage}
                className="bg-[#10ac84] hover:bg-[#0e8b6b] text-white p-4 rounded-full transition-all active:scale-95"
              >
                ◀ Önceki
              </button>

              {/* Slider */}
              <div className="flex-1 flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max={scanImages.length - 1}
                  value={currentImageIndex}
                  onChange={(e) =>
                    setCurrentImageIndex(parseInt(e.target.value))
                  }
                  className="w-full cursor-pointer"
                />
                <span className="text-white text-sm font-bold whitespace-nowrap">
                  {currentImageIndex + 1}/{scanImages.length}
                </span>
              </div>

              <button
                onClick={handleNextImage}
                className="bg-[#10ac84] hover:bg-[#0e8b6b] text-white p-4 rounded-full transition-all active:scale-95"
              >
                Sonraki ▶
              </button>
            </div>

            {/* Bilgi */}
            <div className="text-center text-gray-300 text-xs">
              <p>Dosya: {scanImages[currentImageIndex]?.name}</p>
              <p>
                Boyut: {(scanImages[currentImageIndex]?.size / 1024).toFixed(1)}
                KB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white px-10 py-4 shadow-sm flex justify-between items-center">
        <h2 className="text-xl font-bold m-0">
          Antares{" "}
          <span className="font-light text-slate-400">Lab Interface v2.1</span>
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

          {/* ✅ YENİ: 360° Tarama Arşivi */}
          <div className="bg-white p-5 rounded-[20px] shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 block">
                360° Tarama Arşivi
              </span>
              <button
                onClick={loadArchiveFiles}
                disabled={archiveLoading}
                className="text-[0.7rem] font-bold text-[#00d2ff] hover:text-[#0bb9d3] disabled:opacity-50"
              >
                {archiveLoading ? "⏳ Yükleniyor..." : "🔄 Yenile"}
              </button>
            </div>

            {archiveFiles.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>Henüz tarama arşivi yok</p>
                <p className="text-xs mt-2">
                  Tarama başlatıp arşivi yükledikten sonra görseller burada
                  görünecek
                </p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-4">
                {archiveFiles.map((file, i) => (
                  <div
                    key={file.name}
                    onClick={() => openScan360(file.name)}
                    className="w-[120px] h-[90px] bg-[#f9f9f9] border-2 border-dashed border-[#eee] rounded-xl flex-shrink-0 flex flex-col items-center justify-center text-[#ccc] text-[10px] hover:border-[#00d2ff] hover:bg-[#f0f8ff] transition-all cursor-pointer"
                  >
                    <span className="font-bold text-[#00d2ff]">📸</span>
                    <span className="text-[8px] mt-1 text-center px-1">
                      {file.name.substring(0, 12)}...
                    </span>
                    <span className="text-[7px] text-slate-400 mt-1">
                      {(file.size / 1024).toFixed(1)}KB
                    </span>
                  </div>
                ))}
              </div>
            )}

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
              Donanım Kontrolü (v2.1: Real-time)
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
