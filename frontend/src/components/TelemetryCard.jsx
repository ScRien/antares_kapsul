import React from "react";

export default function TelemetryCard({ data }) {
  return (
    <div className="bg-white p-6 rounded-[20px] shadow-sm">
      <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-6 block">
        Anlik Telemetri
      </span>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 border-l-4 border-[#ff9f43] rounded-r-xl">
          <span className="text-[10px] text-slate-400 font-bold uppercase">
            Sicaklik
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
          <span className="text-3xl font-light block mt-1">%{data.h}</span>
        </div>
      </div>

      <div className="mt-4 p-4 bg-slate-50 border-l-4 border-[#10ac84] rounded-r-xl">
        <span className="text-[10px] text-slate-400 font-bold uppercase">
          Toprak Baglami
        </span>
        <span className="text-lg font-semibold block mt-1 text-[#10ac84]">
          {data.s}
        </span>
      </div>
    </div>
  );
}
