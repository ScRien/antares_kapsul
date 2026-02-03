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

      // Iyimser güncelleme (optimistic update)
      const oldValue = currentValue;
      onDataUpdate((prev) => ({
        ...prev,
        [type === "fan1" ? "f1" : "f2"]: newIntVal,
      }));

      onStatusChange(`⏳ ${type} komutu gönderiliyor...`);

      try {
        // ✅ FIX: Query string'i doğru şekilde oluştur
        const params = {};
        if (type === "fan1") {
          params.fan1 = newValue;
        } else if (type === "fan2") {
          params.fan2 = newValue;
        }

        const response = await axios.get(`${API_BASE}/cmd`, {
          params: params,
          // ✅ ÖNEMLI: Interceptor token ekleyecek, başa Bearer yazma
        });

        console.log(`✅ ${type} başarıyla ${newValue} yapıldı.`);
        console.log("Backend response:", response.data);

        // Backend state'ini al
        if (response.data.hardwareState) {
          const stateKey = type === "fan1" ? "f1" : "f2";
          onDataUpdate((prev) => ({
            ...prev,
            [stateKey]: response.data.hardwareState[stateKey] ?? newIntVal,
          }));
        }

        onStatusChange(`✅ ${type} başarıyla ${newValue} yapıldı`);
        setTimeout(() => onStatusChange(""), 3000);
      } catch (err) {
        console.error("❌ Komut hatası:", err.message);
        console.error("Full error:", err);

        // Rollback - hata durumunda eski değere dön
        onDataUpdate((prev) => ({
          ...prev,
          [type === "fan1" ? "f1" : "f2"]: oldValue,
        }));

        const errorMsg =
          err.response?.data?.message || err.message || "Ağ bağlantısı hatası";
        onStatusChange(`❌ ${type} başarısız - ${errorMsg}`);
        alert(`❌ Komut gönderilemedi!\n\n${errorMsg}`);
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
