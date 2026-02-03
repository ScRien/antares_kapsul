import React, { useState, useEffect } from "react";
import axios from "axios";

import LoginOverlay from "./components/LoginOverlay";
import Header from "./components/Header";
import StatusIndicator from "./components/StatusIndicator";
import StreamCard from "./components/StreamCard";
import ArchiveCard from "./components/ArchiveCard";
import TelemetryCard from "./components/TelemetryCard";
import HardwareControl from "./components/HardwareControl";
import LCDTerminal from "./components/LCDTerminal";
import Viewer360Modal from "./components/Viewer360Modal";

import { useSensorData } from "./hooks/useSensorData";
import { useHardwareControl } from "./hooks/useHardwareControl";
import { useAuth } from "./hooks/useAuth";

const API_BASE = "https://antares-backend.onrender.com/api";

function App() {
  // Authentication hook
  const {
    isLoggedIn,
    token,
    isLoading: authLoading,
    error: authError,
    user,
    attemptCount,
    isLockedOut,
    lockoutTime,
    login,
    logout,
  } = useAuth();

  // Sensor data - ✅ lastDataUpdate'i doğru al
  const { data, lastDataUpdate } = useSensorData(token, isLoggedIn);
  const [dataState, setDataState] = useState(
    data || {
      t: "--",
      h: "--",
      s: "Bağlantısız",
      f1: 0,
      f2: 0,
    },
  );

  // Command feedback
  const [commandStatus, setCommandStatus] = useState("");

  // LCD state
  const [lcdMsg, setLcdMsg] = useState("");

  // Archive state
  const [archiveFiles, setArchiveFiles] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [selectedScan, setSelectedScan] = useState(null);
  const [viewerActive, setViewerActive] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [scanImages, setScanImages] = useState([]);

  // Hardware control hook
  const { f1Loading, f2Loading, toggleHardware } =
    useHardwareControl(setCommandStatus);

  // Update dataState when data changes from hook
  React.useEffect(() => {
    if (data) {
      setDataState(data);
    }
  }, [data]);

  // Axios interceptor - Tüm isteklere token ekle
  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      if (token && isLoggedIn) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return () => axios.interceptors.request.eject(interceptor);
  }, [token, isLoggedIn]);

  // === LOGIN HANDLERS ===
  const handleLogin = async (password) => {
    return await login(password);
  };

  const handleLogout = () => {
    logout();
    setCommandStatus("");
    setLcdMsg("");
    setArchiveFiles([]);
    setSelectedScan(null);
    setViewerActive(false);
  };

  // === HARDWARE HANDLERS ===
  const handleToggleFan = async (type) => {
    if (!isLoggedIn || !token) {
      alert("Oturum geçersiz! Lütfen tekrar giriş yapın.");
      handleLogout();
      return;
    }

    await toggleHardware(
      type,
      type === "fan1" ? dataState.f1 : dataState.f2,
      setDataState,
    );
  };

  // === LCD HANDLERS ===
  const handleSendLcdMsg = () => {
    if (!isLoggedIn || !token) {
      alert("Oturum geçersiz! Lütfen tekrar giriş yapın.");
      handleLogout();
      return;
    }

    if (!lcdMsg.trim()) {
      alert("Lütfen bir mesaj yazın!");
      return;
    }

    if (lcdMsg.length > 20) {
      alert(
        `❌ LCD maksimum 20 karaktere kadar destekler!\n(Şu an: ${lcdMsg.length} karakter)`,
      );
      return;
    }

    setCommandStatus("⏳ LCD mesajı gönderiliyor...");

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

  // === ARCHIVE HANDLERS ===
  const handleLoadArchiveFiles = async () => {
    if (!isLoggedIn || !token) {
      alert("Oturum geçersiz! Lütfen tekrar giriş yapın.");
      handleLogout();
      return;
    }

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

  const handleOpenScan360 = async (fileName) => {
    const scanId = fileName.substring(0, 15);
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

  const handleTriggerScan = () => {
    if (!isLoggedIn || !token) {
      alert("Oturum geçersiz! Lütfen tekrar giriş yapın.");
      handleLogout();
      return;
    }

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

  // === IMAGE NAVIGATION ===
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

  // ✅ lastDataUpdate null check'i
  const safeLastUpdate =
    lastDataUpdate instanceof Date ? lastDataUpdate : new Date();

  return (
    <div className="min-h-screen bg-[#f4f7f6] font-sans text-[#2d3436]">
      {/* Login Overlay */}
      <LoginOverlay
        isLoggedIn={isLoggedIn}
        onLogin={handleLogin}
        isLoading={authLoading}
        error={authError}
        attemptCount={attemptCount}
        isLockedOut={isLockedOut}
        lockoutTime={lockoutTime}
      />

      {/* 360° Viewer Modal */}
      {isLoggedIn && (
        <Viewer360Modal
          viewerActive={viewerActive}
          selectedScan={selectedScan}
          scanImages={scanImages}
          currentImageIndex={currentImageIndex}
          onClose={() => setViewerActive(false)}
          onPrevImage={handlePrevImage}
          onNextImage={handleNextImage}
          onSliderChange={setCurrentImageIndex}
        />
      )}

      {/* Header */}
      {isLoggedIn && (
        <>
          <Header
            lastDataUpdate={safeLastUpdate}
            user={user}
            onLogout={handleLogout}
          />

          {/* Command Status Indicator */}
          <StatusIndicator commandStatus={commandStatus} />

          {/* Main Content */}
          <main className="max-w-[1300px] mx-auto my-5 px-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 pb-10">
            {/* Left Column - Visual */}
            <section className="space-y-6">
              <StreamCard />

              <ArchiveCard
                archiveFiles={archiveFiles}
                archiveLoading={archiveLoading}
                onLoadArchive={handleLoadArchiveFiles}
                onOpenScan={handleOpenScan360}
                onTriggerScan={handleTriggerScan}
              />
            </section>

            {/* Right Column - Controls */}
            <section className="space-y-6">
              <TelemetryCard data={dataState} />

              <HardwareControl
                data={dataState}
                f1Loading={f1Loading}
                f2Loading={f2Loading}
                onToggleFan={handleToggleFan}
              />

              <LCDTerminal
                lcdMsg={lcdMsg}
                onLcdMsgChange={setLcdMsg}
                onSendMsg={handleSendLcdMsg}
              />
            </section>
          </main>
        </>
      )}
    </div>
  );
}

export default App;
