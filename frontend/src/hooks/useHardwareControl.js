import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = "https://antares-backend.onrender.com/api";
// const API_BASE = "http://localhost:3000/api"; // Local dev

export function useHardwareControl(onStatusChange) {
  const [f1Loading, setF1Loading] = useState(false);
  const [f2Loading, setF2Loading] = useState(false);

  const toggleHardware = useCallback(
    async (type, currentValue, onDataUpdate) => {
      const isCurrentlyOn = currentValue === 1;
      const newValue = isCurrentlyOn ? "OFF" : "ON";
      const newIntVal = isCurrentlyOn ? 0 : 1;

      // Loading state
      if (type === "fan1") setF1Loading(true);
      else setF2Loading(true);

      // Optimistic update
      const oldValue = currentValue;
      onDataUpdate((prev) => ({
        ...prev,
        [type === "fan1" ? "f1" : "f2"]: newIntVal,
      }));

      onStatusChange(`Komut gonderiliyor...`);

      try {
        const params = {};
        if (type === "fan1") {
          params.fan1 = newValue;
        } else if (type === "fan2") {
          params.fan2 = newValue;
        }

        const response = await axios.get(`${API_BASE}/cmd`, {
          params: params,
        });

        console.log(`${type} basarili: ${newValue}`);

        // Backend state'i al
        if (response.data.hardwareState) {
          const stateKey = type === "fan1" ? "f1" : "f2";
          onDataUpdate((prev) => ({
            ...prev,
            [stateKey]: response.data.hardwareState[stateKey] ?? newIntVal,
          }));
        }

        onStatusChange(`${type} basarili: ${newValue}`);
        setTimeout(() => onStatusChange(""), 3000);
      } catch (err) {
        console.error("Komut hatasi:", err.message);

        // Rollback
        onDataUpdate((prev) => ({
          ...prev,
          [type === "fan1" ? "f1" : "f2"]: oldValue,
        }));

        const errorMsg =
          err.response?.data?.message || err.message || "Ag baglantisi hatasi";
        onStatusChange(`${type} basarisiz`);
        alert(`Komut gonderilemedi!\n\n${errorMsg}`);
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
