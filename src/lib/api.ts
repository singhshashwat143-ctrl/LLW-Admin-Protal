import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "llw-auth-session";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:4000" : "")).replace(/\/$/, "");

function resolveApiPath(path: string) {
  if (!API_BASE_URL || /^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let authHeaders: Record<string, string> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string };
      if (parsed?.token) {
        authHeaders = { Authorization: `Bearer ${parsed.token}` };
      }
    }
  } catch {
    // Ignore invalid local storage and continue without auth headers.
  }

  const response = await fetch(resolveApiPath(path), {
    headers: { "Content-Type": "application/json", ...authHeaders, ...(init?.headers || {}) },
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function useApi<T>(path: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<T>(path)
      .then((response) => {
        if (active) setData(response);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);

  return { data, loading, setData, refresh };
}
