import React from "react";

const API_BASE = "https://antares-backend.onrender.com/api";

export default function LCDTerminal({ lcdMsg, onLcdMsgChange, onSendMsg }) {
  // ✅ FIX: Formda Enter tuşu desteği ekle
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.ctrlKey) {
      e.preventDefault();
      onSendMsg();
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    // ✅ FIX: 20 karakter limiti ekle
    if (value.length <= 20) {
      onLcdMsgChange(value);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[20px] shadow-sm">
      <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-6 block">
        LCD Terminal Mesajı
      </span>
      <input
        type="text"
        placeholder="Ekrana yazılacak mesaj (max 20 char)..."
        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl mb-4 outline-none focus:border-[#00d2ff] text-sm"
        value={lcdMsg}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength="20"
      />
      <div className="text-xs text-slate-400 mb-3">
        {lcdMsg.length}/20 karakter
      </div>
      <button
        onClick={onSendMsg}
        disabled={lcdMsg.trim().length === 0}
        className="w-full bg-[#00d2ff] text-white p-4 rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all text-sm tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Mesajı Gönder
      </button>
      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
        ℹ️ Mesaj Arduino LCD ekranına 📬 gönderilecek
      </div>
    </div>
  );
}
