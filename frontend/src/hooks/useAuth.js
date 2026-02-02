import { useState, useEffect, useCallback } from "react";

const API_BASE = "https://antares-backend.onrender.com/api";
const TOKEN_KEY = "antares_auth_token";
const TOKEN_EXPIRY_KEY = "antares_token_expiry";

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Sayfa yüklendığinde token kontrol et
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
      } else {
        logout();
      }
    } catch (err) {
      console.error("Token verification failed:", err);
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

      setIsLoading(true);
      setError(null);

      try {
        // Mock API çağrısı (backend hazırlanırken)
        // Gerçek backend'de: POST /api/auth/login
        const response = await mockAuthAPI(password);

        if (response.success) {
          const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat

          // Token'ı sakla
          localStorage.setItem(TOKEN_KEY, response.token);
          localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toISOString());

          // State'i güncelle
          setToken(response.token);
          setIsLoggedIn(true);
          setUser(response.user);
          setAttemptCount(0);
          setIsLockedOut(false);
          setError(null);

          return true;
        } else {
          // Yanlış şifre
          const newAttempts = attemptCount + 1;
          setAttemptCount(newAttempts);
          setError(response.message || "Şifre yanlış!");

          // 3 yanlış denemeden sonra lockout
          if (newAttempts >= 3) {
            setIsLockedOut(true);
            setLockoutTime(30000); // 30 saniye lockout

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

          return false;
        }
      } catch (err) {
        setError("Bağlantı hatası. Lütfen daha sonra tekrar deneyin.");
        console.error("Login error:", err);
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

        return true;
      } else {
        logout();
        return false;
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
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

// Mock Authentication API (Backend hazırlanırken)
async function mockAuthAPI(password) {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (password === "1234") {
        resolve({
          success: true,
          token: generateMockToken(),
          user: {
            username: "Lab Admin",
            role: "system_admin",
            email: "admin@antares-lab.io",
          },
        });
      } else {
        resolve({
          success: false,
          message: "Şifre geçersiz! Sistem yöneticisine başvurunuz.",
        });
      }
    }, 800); // Gerçekçi ağ gecikmesi
  });
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
