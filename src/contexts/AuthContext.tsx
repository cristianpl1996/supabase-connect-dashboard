import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { login as apiLogin, setToken, clearToken, getToken, type AuthUser, type LoginRequest } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const USER_KEY = "ivanagro_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate session from localStorage on mount
  useEffect(() => {
    const token = getToken();
    const storedUser = localStorage.getItem(USER_KEY);
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser) as AuthUser);
      } catch {
        clearToken();
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const res = await apiLogin(credentials);
    setToken(res.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
