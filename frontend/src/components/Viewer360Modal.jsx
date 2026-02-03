import React from "react";

const API_BASE = "https://antares-backend.onrender.com/api";

export default function Viewer360Modal({
  viewerActive,
  selectedScan,
  scanImages,
  currentImageIndex,
  onClose,
  onPrevImage,
  onNextImage,
  onSliderChange,
}) {
  if (!viewerActive || !selectedScan) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[10000] flex flex-col items-center justify-center p-4">
      {/* Başlık */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-bold">360° Tarama Görüntüleyicisi</h3>
            <p className="text-sm text-gray-300 mt-1">
              Tarih: {selectedScan.timestamp} | Toplam: {selectedScan.count}{" "}
              görüntü
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white text-3xl font-bold hover:text-gray-400"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Ana görüntü */}
      <div className="relative w-full h-full flex items-center justify-center">
        {scanImages.length > 0 && (
          <img
            key={scanImages[currentImageIndex].name}
            src={`${API_BASE}/archive/file?name=${encodeURIComponent(
              scanImages[currentImageIndex].name,
            )}`}
            alt={`Görüntü ${currentImageIndex + 1}`}
            className="max-w-[90%] max-h-[85%] object-contain"
          />
        )}
      </div>

      {/* Alt kontroller */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
        <div className="flex items-center justify-center gap-8 mb-4">
          <button
            onClick={onPrevImage}
            className="bg-[#10ac84] hover:bg-[#0e8b6b] text-white p-4 rounded-full transition-all active:scale-95"
          >
            ◀ Önceki
          </button>

          {/* Slider */}
          <div className="flex-1 flex items-center gap-4">
            <input
              type="range"
              min="0"
              max={scanImages.length - 1}
              value={currentImageIndex}
              onChange={(e) => onSliderChange(parseInt(e.target.value))}
              className="w-full cursor-pointer"
            />
            <span className="text-white text-sm font-bold whitespace-nowrap">
              {currentImageIndex + 1}/{scanImages.length}
            </span>
          </div>

          <button
            onClick={onNextImage}
            className="bg-[#10ac84] hover:bg-[#0e8b6b] text-white p-4 rounded-full transition-all active:scale-95"
          >
            Sonraki ▶
          </button>
        </div>

        {/* Bilgi */}
        <div className="text-center text-gray-300 text-xs">
          <p>Dosya: {scanImages[currentImageIndex]?.name}</p>
          <p>
            Boyut: {(scanImages[currentImageIndex]?.size / 1024).toFixed(1)}
            KB
          </p>
        </div>
      </div>
    </div>
  );
}
