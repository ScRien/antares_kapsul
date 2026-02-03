import { useState, useEffect, useCallback } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";
// const API_BASE = "http://localhost:3000/api"; // Local dev

const TOKEN_KEY = "antares_auth_token";
const TOKEN_EXPIRY_KEY = "antares_token_expiry";
const LOCKOUT_DURATION = 30000; // 30 saniye

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Token kontrolu (sayfa yuklemede)
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

    if (storedToken && storedExpiry) {
      const expiryTime = new Date(storedExpiry).getTime();
      const currentTime = new Date().getTime();

      if (currentTime < expiryTime) {
        setToken(storedToken);
        setIsLoggedIn(true);
        verifyToken(storedToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        setError("Oturum suresi doldu. Lutfen tekrar giris yapin.");
      }
    }
  }, []);

  // Token dogrulama
  const verifyToken = useCallback(async (authToken) => {
    try {
      const response = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user || { username: "Lab Admin", role: "system_admin" });
        console.log("Token verified");
      } else {
        logout();
        setError("Token gecersiz.");
      }
    } catch (err) {
      console.error("Token dogrulama basarisiz:", err);
    }
  }, []);

  // Login
  const login = useCallback(
    async (password) => {
      // Lockout kontrolu
      if (isLockedOut && lockoutTime > 0) {
        const remainingTime = Math.ceil(lockoutTime / 1000);
        setError(
          `Cok fazla yanlis deneme. ${remainingTime} saniye sonra tekrar deneyin.`,
        );
        return false;
      }

      if (!password || password.trim() === "") {
        setError("Lutfen sifre girin!");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: password.trim() }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toISOString());

          setToken(data.token);
          setIsLoggedIn(true);
          setUser(data.user || { username: "Lab Admin", role: "system_admin" });
          setAttemptCount(0);
          setIsLockedOut(false);
          setError(null);

          console.log("Basarili giris");
          return true;
        } else {
          // Yanlis sifre
          const newAttempts = attemptCount + 1;
          setAttemptCount(newAttempts);
          setError(data.message || "Sifre yanlis!");

          if (newAttempts >= 3) {
            setIsLockedOut(true);
            setLockoutTime(LOCKOUT_DURATION);

            const timer = setInterval(() => {
              setLockoutTime((prev) => {
                if (prev <= 1000) {
                  clearInterval(timer);
                  setIsLockedOut(false);
                  setAttemptCount(0);
                  return 0;
                }
                return prev - 1000;
              });
            }, 1000);
          }

          return false;
        }
      } catch (err) {
        console.error("Login hatasi:", err);
        setError("Baglanti hatasi. Lutfen daha sonra tekrar deneyin.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [attemptCount, isLockedOut, lockoutTime],
  );

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setToken(null);
    setIsLoggedIn(false);
    setUser(null);
    setError(null);
    setAttemptCount(0);
    setIsLockedOut(false);
  }, []);

  // Token refresh
  const refreshToken = useCallback(async () => {
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toISOString());
        setToken(data.token);

        return true;
      } else {
        logout();
        return false;
      }
    } catch (err) {
      console.error("Token refresh hatasi:", err);
      return false;
    }
  }, [token, logout]);

  return {
    isLoggedIn,
    token,
    isLoading,
    error,
    user,
    attemptCount,
    isLockedOut,
    lockoutTime,
    login,
    logout,
    refreshToken,
  };
}
