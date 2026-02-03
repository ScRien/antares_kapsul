import { useState, useEffect, useCallback } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";
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

  // Sayfa yüklendiğinde token kontrol et
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

    if (storedToken && storedExpiry) {
      const expiryTime = new Date(storedExpiry).getTime();
      const currentTime = new Date().getTime();

      if (currentTime < expiryTime) {
        // Token hala geçerli
        setToken(storedToken);
        setIsLoggedIn(true);
        verifyToken(storedToken);
      } else {
        // Token süresi dolmuş
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        setError("Oturum süresi doldu. Lütfen tekrar giriş yapın.");
      }
    }
  }, []);

  // Token doğrulama
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
        setUser(data.user || { username: "Admin", role: "system_admin" });
        console.log("✅ Token verified");
      } else if (response.status === 401) {
        // Token geçersiz, logout yap
        logout();
        setError("Token geçersiz. Lütfen tekrar giriş yapın.");
      }
    } catch (err) {
      console.error("❌ Token verification failed:", err);
      // Network hatası - token'ı saklı tut, retry'ya izin ver
    }
  }, []);

  // Login fonksiyonu
  const login = useCallback(
    async (password) => {
      // Lockout kontrolü
      if (isLockedOut && lockoutTime > 0) {
        const remainingTime = Math.ceil(lockoutTime / 1000);
        setError(
          `Çok fazla yanlış deneme. ${remainingTime} saniye sonra tekrar deneyin.`,
        );
        return false;
      }

      if (!password || password.trim() === "") {
        setError("Lütfen şifre girin!");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Backend'e login isteği gönder
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: password.trim() }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Başarılı login
          const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat

          // Token'ı sakla
          localStorage.setItem(TOKEN_KEY, data.token);
          localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toISOString());

          // State'i güncelle
          setToken(data.token);
          setIsLoggedIn(true);
          setUser(data.user || { username: "Lab Admin", role: "system_admin" });
          setAttemptCount(0);
          setIsLockedOut(false);
          setError(null);

          console.log("✅ Başarıyla giriş yapıldı");
          return true;
        } else {
          // Yanlış şifre
          const newAttempts = attemptCount + 1;
          setAttemptCount(newAttempts);
          setError(data.message || "Şifre yanlış!");

          // 3 yanlış denemeden sonra lockout
          if (newAttempts >= 3) {
            setIsLockedOut(true);
            setLockoutTime(LOCKOUT_DURATION);

            // Lockout timer başlat
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

          console.log(`❌ Login başarısız. Deneme: ${newAttempts}/3`);
          return false;
        }
      } catch (err) {
        console.error("❌ Login error:", err);

        // Fallback: Mock auth (backend hazırlanmadıysa)
        if (password === "antares2026") {
          const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const mockToken = generateMockToken();

          localStorage.setItem(TOKEN_KEY, mockToken);
          localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toISOString());

          setToken(mockToken);
          setIsLoggedIn(true);
          setUser({ username: "Lab Admin", role: "system_admin" });
          setAttemptCount(0);
          setIsLockedOut(false);
          setError(null);

          console.log("✅ Mock auth ile giriş yapıldı");
          return true;
        }

        setError("Bağlantı hatası. Lütfen daha sonra tekrar deneyin.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [attemptCount, isLockedOut, lockoutTime],
  );

  // Logout fonksiyonu
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    setToken(null);
    setIsLoggedIn(false);
    setUser(null);
    setError(null);
    setAttemptCount(0);
    setIsLockedOut(false);
    console.log("✅ Çıkış yapıldı");
  }, []);

  // Token refresh (opsiyonel, token süresi dolmakta ise)
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

        console.log("✅ Token refreshed");
        return true;
      } else if (response.status === 401) {
        logout();
        return false;
      }
    } catch (err) {
      console.error("❌ Token refresh failed:", err);
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

// Mock JWT token üretme (gerçek JWT ile değiştirilecek)
function generateMockToken() {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: "admin",
      name: "Lab Admin",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    }),
  );
  const signature = btoa("mock-signature-key");

  return `${header}.${payload}.${signature}`;
}
