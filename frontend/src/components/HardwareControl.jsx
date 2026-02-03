import React from "react";

export default function HardwareControl({
  data,
  f1Loading,
  f2Loading,
  onToggleFan,
}) {
  return (
    <div className="bg-white p-6 rounded-[20px] shadow-sm">
      <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 mb-6 block">
        Donanim Kontrolu (v2.1: Real-time)
      </span>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#fcfcfc] p-4 rounded-2xl border border-[#f0f0f0] text-center">
          <span className="text-[10px] font-bold text-slate-400 block mb-3 uppercase">
            Salyangoz (F1)
          </span>
          <button
            onClick={() => onToggleFan("fan1")}
            disabled={f1Loading}
            className={`w-full py-3 rounded-xl font-black text-xs transition-all ${
              data.f1 === 1
                ? "bg-[#10ac84] text-white shadow-lg shadow-green-100"
                : "bg-[#eee] text-slate-400"
            } ${f1Loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {f1Loading ? "bekle..." : data.f1 === 1 ? "ACIK" : "KAPALI"}
          </button>
        </div>

        <div className="bg-[#fcfcfc] p-4 rounded-2xl border border-[#f0f0f0] text-center">
          <span className="text-[10px] font-bold text-slate-400 block mb-3 uppercase">
            Duz Fan (F2)
          </span>
          <button
            onClick={() => onToggleFan("fan2")}
            disabled={f2Loading}
            className={`w-full py-3 rounded-xl font-black text-xs transition-all ${
              data.f2 === 1
                ? "bg-[#10ac84] text-white shadow-lg shadow-green-100"
                : "bg-[#eee] text-slate-400"
            } ${f2Loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {f2Loading ? "bekle..." : data.f2 === 1 ? "ACIK" : "KAPALI"}
          </button>
        </div>
      </div>
    </div>
  );
}
