import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar_url?: string;
};

type AuthState = {
  user: AuthUser | null;
  googleClientId: string;
  ready: boolean;
  signInWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = "llw-auth-session";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [googleClientId, setGoogleClientId] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    let savedToken = "";
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { user?: AuthUser; token?: string };
        if (parsed?.user) {
          setUser(parsed.user);
        }
        savedToken = parsed?.token || "";
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    Promise.allSettled([
      api<{ googleClientId?: string }>("/api/auth/config").then((response) => {
        setGoogleClientId(response.googleClientId || "");
      }),
      savedToken
        ? api<{ user: AuthUser }>("/api/auth/me")
          .then((response) => {
            setUser(response.user);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: response.user, token: savedToken }));
          })
          .catch(() => {
            setUser(null);
            window.localStorage.removeItem(STORAGE_KEY);
          })
        : Promise.resolve(),
    ]).finally(() => {
      setReady(true);
    });
  }, []);

  async function signInWithGoogle(credential: string) {
    const response = await api<{ user: AuthUser; token: string }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    setUser(response.user);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: response.user, token: response.token }));
  }

  function logout() {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo(
    () => ({ user, googleClientId, ready, signInWithGoogle, logout }),
    [user, googleClientId, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
