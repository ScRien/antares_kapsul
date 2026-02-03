import React, { useState } from "react";

export default function LoginOverlay({
  isLoggedIn,
  onLogin,
  isLoading,
  error,
  attemptCount,
  isLockedOut,
  lockoutTime,
}) {
  const [passInput, setPassInput] = useState("");

  const handleLogin = async () => {
    if (passInput.trim() === "") {
      alert("Lütfen şifre girin!");
      return;
    }

    const success = await onLogin(passInput);
    if (success) {
      setPassInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !isLoading && !isLockedOut) {
      handleLogin();
    }
  };

  // Lockout zamanını formatla
  const formatLockoutTime = () => {
    const seconds = Math.ceil(lockoutTime / 1000);
    return `${seconds}s`;
  };

  return (
    <div
      className={`fixed inset-0 bg-gradient-to-br from-white via-blue-50 to-cyan-50 z-[9999] flex items-center justify-center transition-all duration-[800ms] ease-[cubic-bezier(0.85,0,0.15,1)] ${
        isLoggedIn
          ? "-translate-y-full opacity-0 pointer-events-none"
          : "translate-y-0 opacity-100"
      }`}
    >
      {/* Arka plan dekorasyonu */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-cyan-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* Giriş formu */}
      <div className="relative text-center p-10 max-w-[380px] w-[90%] bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30">
        {/* Logo */}
        <div className="mb-6">
          <div className="inline-block">
            <div className="text-5xl font-black bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent tracking-tighter">
              ANTARES
            </div>
            <div className="h-1 w-16 bg-gradient-to-r from-cyan-500 to-blue-600 mx-auto mt-2 rounded-full"></div>
          </div>
        </div>

        {/* Başlık */}
        <p className="mb-2 text-lg font-semibold text-gray-800">
          Lab Interface v2.1
        </p>
        <p className="mb-6 text-sm text-gray-500">Artifact Protection System</p>

        {/* Hata mesajı */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-sm font-medium text-red-800">{error}</p>
            {attemptCount > 0 && !isLockedOut && (
              <p className="text-xs text-red-600 mt-1">
                Kalan deneme: {3 - attemptCount}
              </p>
            )}
          </div>
        )}

        {/* Lockout durumu */}
        {isLockedOut && (
          <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
            <p className="text-sm font-semibold text-yellow-800">
              ⏳ Çok fazla yanlış deneme
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              {formatLockoutTime()} sonra tekrar deneyin
            </p>
          </div>
        )}

        {/* Şifre input */}
        <input
          type="password"
          placeholder="Sistem Şifresi"
          className={`w-full px-4 py-3 border-2 rounded-xl mb-4 outline-none transition-all font-medium ${
            isLockedOut
              ? "border-red-300 bg-red-50 text-gray-400 cursor-not-allowed"
              : error
                ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                : "border-gray-300 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          }`}
          value={passInput}
          onChange={(e) => setPassInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || isLockedOut}
          autoFocus
        />

        {/* Giriş butonu */}
        <button
          onClick={handleLogin}
          disabled={isLoading || isLockedOut}
          className={`w-full py-3 rounded-xl font-bold text-white transition-all duration-200 text-sm tracking-widest uppercase ${
            isLoading || isLockedOut
              ? "bg-gray-400 cursor-not-allowed opacity-50"
              : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-300 active:scale-95"
          }`}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="animate-spin">⏳</span> Kontrol Ediliyor...
            </span>
          ) : isLockedOut ? (
            <span>{formatLockoutTime()} Bekle</span>
          ) : (
            "Giriş Yap"
          )}
        </button>

        {/* İnfo notu */}
        <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">🔐 Sistem Şifresi:</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Sistem yöneticisinden şifreyi alınız.
          </p>
        </div>

        {/* Kullanıcı bilgisi */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Sistem: <span className="font-semibold text-cyan-600">● Aktif</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date().toLocaleTimeString("tr-TR")}
          </p>
        </div>
      </div>
    </div>
  );
}
