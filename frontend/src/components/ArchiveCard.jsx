import React from "react";

export default function ArchiveCard({
  archiveFiles,
  archiveLoading,
  onLoadArchive,
  onOpenScan,
  onTriggerScan,
}) {
  return (
    <div className="bg-white p-5 rounded-[20px] shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[0.7rem] font-black text-[#aaa] uppercase tracking-[2px] border-b border-[#f0f0f0] pb-2 block">
          360° Tarama Arşivi
        </span>
        <button
          onClick={onLoadArchive}
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
            Tarama başlatıp arşivi yükledikten sonra görseller burada görünecek
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {archiveFiles.map((file) => (
            <div
              key={file.name}
              onClick={() => onOpenScan(file.name)}
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
        onClick={onTriggerScan}
        className="w-full mt-2 bg-[#10ac84] text-white p-4 rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all uppercase text-sm tracking-widest"
      >
        Yeni 360° Tarama Başlat
      </button>
    </div>
  );
}
