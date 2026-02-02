import React from "react";

export default function LCDTerminal({ lcdMsg, onLcdMsgChange, onSendMsg }) {
  return (
    <div className="bg-white p-6 rounded-[20px] shadow-sm">
      <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-6 block">
        LCD Terminal Mesajı
      </span>
      <input
        type="text"
        placeholder="Ekrana yazılacak mesaj..."
        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl mb-4 outline-none focus:border-[#00d2ff] text-sm"
        value={lcdMsg}
        onChange={(e) => onLcdMsgChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSendMsg()}
        maxLength="20"
      />
      <div className="text-xs text-slate-400 mb-3">
        {lcdMsg.length}/20 karakter
      </div>
      <button
        onClick={onSendMsg}
        className="w-full bg-[#00d2ff] text-white p-4 rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all text-sm tracking-widest uppercase"
      >
        Mesajı Gönder
      </button>
    </div>
  );
}
