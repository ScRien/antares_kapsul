import React from "react";

const API_BASE = "https://antares-backend.onrender.com/api";

export default function StreamCard() {
  return (
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
  );
}
