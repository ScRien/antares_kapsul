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

  // ✅ Token ile birlikte sensor data çağır
  const {
    data,
    lastDataUpdate,
    error: sensorError,
  } = useSensorData(token, isLoggedIn);

  // Local state for UI
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
  useEffect(() => {
    if (data) {
      setDataState(data);
    }
  }, [data]);

  // ✅ Axios interceptor - Tüm isteklere token ekle
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
    setDataState({
      t: "--",
      h: "--",
      s: "Bağlantısız",
      f1: 0,
      f2: 0,
    });
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
  const handleSendLcdMsg = async () => {
    if (!isLoggedIn || !token) {
      alert("Oturum geçersiz! Lütfen tekrar giriş yapın.");
      handleLogout();
      return;
    }

    const trimmedMsg = lcdMsg.trim();

    if (!trimmedMsg) {
      alert("Lütfen bir mesaj yazın!");
      return;
    }

    if (trimmedMsg.length > 20) {
      alert(
        `⚠️ LCD maksimum 20 karaktere kadar destekler!\n(Şu an: ${trimmedMsg.length} karakter)`,
      );
      return;
    }

    setCommandStatus("⏳ LCD mesajı gönderiliyor...");

    try {
      await axios.get(`${API_BASE}/cmd`, {
        params: { msg: trimmedMsg },
        headers: { Authorization: `Bearer ${token}` },
      });

      alert("✅ LCD'ye iletildi!");
      setLcdMsg("");
      setCommandStatus("✅ LCD mesajı gönderildi");
      setTimeout(() => setCommandStatus(""), 3000);
    } catch (err) {
      console.error("LCD msg hatası:", err);
      const errorMsg =
        err.response?.data?.message || err.message || "Bilinmeyen hata";
      alert(`❌ Mesaj gönderilemedi! ${errorMsg}`);
      setCommandStatus("❌ LCD mesajı gönderilemedi");
      setTimeout(() => setCommandStatus(""), 5000);
    }
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
      const res = await axios.get(`${API_BASE}/archive/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.files) {
        setArchiveFiles(res.data.files);
        console.log(
          `✅ ${res.data.count || res.data.files.length} dosya yüklendi`,
        );
      }
    } catch (err) {
      console.error("❌ Arşiv yükleme hatası:", err.message);
      const errorMsg = err.response?.data?.message || "Arşiv yüklenemedi";
      alert(`⚠️ ${errorMsg}`);
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
      timestamp:
        scanFilesArray[0].timestamp || new Date().toLocaleString("tr-TR"),
      count: scanFilesArray.length,
    });
    setCurrentImageIndex(0);
    setViewerActive(true);

    console.log(`🎬 360° Oynatıcı açıldı: ${scanFilesArray.length} görüntü`);
  };

  const handleTriggerScan = async () => {
    if (!isLoggedIn || !token) {
      alert("Oturum geçersiz! Lütfen tekrar giriş yapın.");
      handleLogout();
      return;
    }

    setCommandStatus("⏳ Tarama komutu gönderiliyor...");

    try {
      await axios.get(`${API_BASE}/capture`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      alert("✅ Tarama Komutu Gönderildi.");
      setCommandStatus("✅ 360° Tarama başlatıldı");
      setTimeout(() => setCommandStatus(""), 3000);
    } catch (err) {
      console.error("Capture hatası:", err);
      const errorMsg =
        err.response?.data?.message || "Tarama komutu gönderilemedi";
      alert(`❌ ${errorMsg}`);
      setCommandStatus("❌ Tarama başlatılamadı");
      setTimeout(() => setCommandStatus(""), 5000);
    }
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

          {/* Sensor Error Alert */}
          {sensorError && (
            <div className="fixed top-20 left-5 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg text-sm text-yellow-700 z-40">
              ⚠️ {sensorError}
            </div>
          )}

          {/* Main Content */}
          <main className="max-w-[1300px] mx-auto my-5 px-5 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 pb-10">
            {/* Left Column - Visual */}
            <section className="space-y-6">
              <StreamCard token={token} />

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
