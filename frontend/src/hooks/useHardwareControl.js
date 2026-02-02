import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = "https://antares-backend.onrender.com/api";

export function useHardwareControl(onStatusChange) {
  const [f1Loading, setF1Loading] = useState(false);
  const [f2Loading, setF2Loading] = useState(false);

  const toggleHardware = useCallback(
    async (type, currentValue, onDataUpdate) => {
      const isCurrentlyOn = currentValue === 1;
      const newValue = isCurrentlyOn ? "OFF" : "ON";
      const newIntVal = isCurrentlyOn ? 0 : 1;

      // Loading state başlat
      if (type === "fan1") setF1Loading(true);
      else setF2Loading(true);

      // İyimser güncelleme
      const oldValue = currentValue;
      onDataUpdate((prev) => ({
        ...prev,
        [type === "fan1" ? "f1" : "f2"]: newIntVal,
      }));

      onStatusChange(`⏳ ${type} komutu gönderiliyor...`);

      try {
        const response = await axios.get(`${API_BASE}/cmd`, {
          params: { [type]: newValue },
        });

        console.log(`✅ ${type} başarıyla ${newValue} yapıldı.`);

        // Backend state'ini al
        if (response.data.hardwareState) {
          const stateKey = type === "fan1" ? "f1" : "f2";
          onDataUpdate((prev) => ({
            ...prev,
            [stateKey]: response.data.hardwareState[stateKey] ?? newIntVal,
          }));
        }

        onStatusChange(`✅ ${type} komutu başarılı`);
        setTimeout(() => onStatusChange(""), 3000);
      } catch (err) {
        console.error("Komut hatası:", err);

        // Rollback
        onDataUpdate((prev) => ({
          ...prev,
          [type === "fan1" ? "f1" : "f2"]: oldValue,
        }));

        onStatusChange(`❌ ${type} komutu başarısız - Ağ hatası`);
        alert("Komut gönderilemedi! Ağ bağlantınızı kontrol edin.");
        setTimeout(() => onStatusChange(""), 5000);
      } finally {
        if (type === "fan1") setF1Loading(false);
        else setF2Loading(false);
      }
    },
    [onStatusChange],
  );

  return { f1Loading, f2Loading, toggleHardware };
}
