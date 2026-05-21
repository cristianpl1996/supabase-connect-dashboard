import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { login as apiLogin, setToken, clearToken, getToken, type AuthUser, type LoginRequest, type LoginResponse } from "@/lib/api";
import { toast } from "sonner";

function getJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  finalizeOtpLogin: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => { throw new Error("AuthProvider not mounted"); },
  finalizeOtpLogin: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const USER_KEY = "ivanagro_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlingUnauthorizedRef = useRef(false);

  const doLogout = useCallback(() => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const scheduleExpiryLogout = useCallback((token: string) => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    const expiresAt = getJwtExpiry(token);
    if (!expiresAt) return;
    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      doLogout();
      return;
    }
    expiryTimerRef.current = setTimeout(doLogout, msUntilExpiry);
  }, [doLogout]);

  // Rehydrate session from localStorage on mount
  useEffect(() => {
    const token = getToken();
    const storedUser = localStorage.getItem(USER_KEY);
    if (token && storedUser) {
      const expiry = getJwtExpiry(token);
      if (expiry && expiry <= Date.now()) {
        // Token already expired — clear immediately
        clearToken();
        localStorage.removeItem(USER_KEY);
      } else {
        try {
          setUser(JSON.parse(storedUser) as AuthUser);
          scheduleExpiryLogout(token);
        } catch {
          clearToken();
          localStorage.removeItem(USER_KEY);
        }
      }
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-logout when token expires or session is invalidated (API returns 401)
  useEffect(() => {
    const handleUnauthorized = (e: Event) => {
      if (handlingUnauthorizedRef.current) return;
      handlingUnauthorizedRef.current = true;
      const detail = (e as CustomEvent<string>).detail;
      if (detail?.includes("otro dispositivo")) {
        toast.error("Sesión cerrada", {
          description: "Tu sesión fue iniciada en otro dispositivo.",
          duration: 5000,
        });
      }
      doLogout();
    };
    window.addEventListener("ivanagro:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("ivanagro:unauthorized", handleUnauthorized);
  }, [doLogout]);

  const login = useCallback(async (credentials: LoginRequest): Promise<LoginResponse> => {
    handlingUnauthorizedRef.current = false;
    const res = await apiLogin(credentials);
    if (!res.otp_required && "access_token" in res) {
      setToken(res.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setUser(res.user);
      scheduleExpiryLogout(res.access_token);
    }
    return res;
  }, [scheduleExpiryLogout]);

  const finalizeOtpLogin = useCallback((token: string, authUser: AuthUser) => {
    handlingUnauthorizedRef.current = false;
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    setUser(authUser);
    scheduleExpiryLogout(token);
  }, [scheduleExpiryLogout]);

  const logout = useCallback(() => {
    toast.success("Sesión cerrada", {
      description: "Has cerrado sesión exitosamente.",
      duration: 3000,
    });
    doLogout();
  }, [doLogout]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, finalizeOtpLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
