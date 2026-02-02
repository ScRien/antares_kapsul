import React from "react";

export default function Header({ lastDataUpdate, user, onLogout }) {
  return (
    <header className="bg-white px-10 py-4 shadow-sm flex justify-between items-center border-b border-gray-100">
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-bold m-0">
          Antares{" "}
          <span className="font-light text-slate-400">Lab Interface v2.1</span>
        </h2>
      </div>

      <div className="flex items-center gap-8">
        {/* Sistem Durumu */}
        <div className="text-[#10ac84] font-bold animate-pulse flex items-center gap-2 text-sm uppercase tracking-widest">
          <span className="text-lg">●</span> SİSTEM ÇEVRİMİÇİ
        </div>

        {/* Son Güncelleme */}
        <div className="text-[10px] text-slate-400">
          Son güncelleme: {lastDataUpdate.toLocaleTimeString("tr-TR")}
        </div>

        {/* Kullanıcı Bilgisi */}
        {user && (
          <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
            <div className="text-right text-xs">
              <p className="font-semibold text-gray-700">{user.username}</p>
              <p className="text-gray-500">{user.role || "System Admin"}</p>
            </div>

            {/* Logout Butonu */}
            <button
              onClick={onLogout}
              className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors duration-200"
              title="Oturumu kapat"
            >
              Çıkış
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
