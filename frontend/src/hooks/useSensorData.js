import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "https://antares-backend.onrender.com/api";

export function useSensorData(token, isLoggedIn) {
  const [data, setData] = useState({
    t: "--",
    h: "--",
    s: "Ölçülüyor...",
    f1: 0,
    f2: 0,
  });
  const [lastDataUpdate, setLastDataUpdate] = useState(new Date());

  useEffect(() => {
    // Login olmadıysa veri çekme
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
        // Sessiz başarısız - Backend olmadığında hata gösterme
        if (e.response?.status === 401) {
          console.warn("Token expired or invalid");
        }
      }
    };

    // İlk çekme
    fetchData();

    // 2 saniyede bir veri çek
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [token, isLoggedIn]);

  return { data, lastDataUpdate };
}
