import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "https://antares-backend.onrender.com/api";

export function useSensorData(token, isLoggedIn) {
  const [data, setData] = useState({
    t: "--",
    h: "--",
    s: "Olculuyor...",
    f1: 0,
    f2: 0,
  });
  const [lastDataUpdate, setLastDataUpdate] = useState(new Date());

  useEffect(() => {
    // Login olmadiysa veri cekme
    if (!isLoggedIn || !token) {
      return;
    }

    const client = axios.create({
      baseURL: API_BASE,
      timeout: 8000,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const fetchData = async () => {
      try {
        const res = await client.get("/data");
        if (res.data && typeof res.data === "object") {
          setData(res.data);
          setLastDataUpdate(new Date());
        }
      } catch (e) {
        // Sessiz basarısız - Backend olmadığında hata gösterme
        if (e.response?.status === 401) {
          console.warn("Token expired or invalid");
        }
      }
    };

    // İlk çekme
    fetchData();

    // 15 saniyede bir veri çek (sistem performansı için, eski: 2 saniye)
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [token, isLoggedIn]);

  return { data, lastDataUpdate };
}
