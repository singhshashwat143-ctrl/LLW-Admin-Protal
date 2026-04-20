import { useEffect, useRef, useState } from "react";
import logo from "../assets/logo.png";
import { useAuth } from "../lib/auth";
import type { ThemeMode } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function LoginGate({
  theme,
  onToggleTheme,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const { googleClientId, signInWithGoogle, ready } = useAuth();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const scriptId = "google-identity-script";
    if (document.getElementById(scriptId)) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!ready || !googleClientId || !window.google || !buttonRef.current) {
        return;
      }

      window.clearInterval(interval);
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          try {
            if (!response.credential) {
              throw new Error("Google did not return a credential.");
            }
            setNotice("");
            await signInWithGoogle(response.credential);
          } catch (error) {
            setNotice(error instanceof Error ? error.message : "Unable to sign in with Google.");
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: theme === "dark" ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        width: 320,
        text: "continue_with",
      });
      window.google.accounts.id.prompt();
    }, 250);

    return () => window.clearInterval(interval);
  }, [googleClientId, ready, signInWithGoogle, theme]);

  return (
    <div className="login-shell">
      <div className="login-toolbar">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="login-panel">
        <div className="login-brand">
          <img src={logo} alt="Livelong Wealth" className="login-logo" />
          <div>
            <p className="login-kicker">Livelong Wealth</p>
            <h1 className="login-title">Admin Workspace</h1>
            <p className="login-copy">Sign in with Google to access payments, webinars, tracking, and operations in one place.</p>
          </div>
        </div>

        <div className="login-card">
          <p className="login-card-title">Secure Sign-In</p>
          <p className="login-card-copy">Use your Google account. Your session is verified by the backend before the dashboard opens.</p>
          <div ref={buttonRef} className="min-h-[44px]" />
          {notice ? <p className="login-error">{notice}</p> : null}
        </div>
      </div>
    </div>
  );
}
