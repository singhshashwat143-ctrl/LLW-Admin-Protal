import { useEffect, useState } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on?: (event: string, handler: (payload: any) => void) => void };
  }
}

const scriptId = "razorpay-checkout-script";
const scriptSrc = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise: Promise<void> | null = null;

function appendHeadLink(rel: "preconnect" | "dns-prefetch", href: string) {
  if (document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (rel === "preconnect") {
    link.crossOrigin = "anonymous";
  }
  document.head.appendChild(link);
}

function ensureRazorpayHints() {
  appendHeadLink("preconnect", "https://checkout.razorpay.com");
  appendHeadLink("dns-prefetch", "https://checkout.razorpay.com");
}

export function ensureRazorpayLoaded() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay is only available in the browser."));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  ensureRazorpayHints();

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout."));
    document.head.appendChild(script);
  }).catch((error) => {
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

export function useRazorpayCheckout() {
  const [ready, setReady] = useState(Boolean(typeof window !== "undefined" && window.Razorpay));
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    ensureRazorpayLoaded()
      .then(() => {
        if (!active) return;
        setReady(true);
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setReady(false);
        setLoadError(error instanceof Error ? error.message : "Failed to load Razorpay checkout.");
      });

    return () => {
      active = false;
    };
  }, []);

  return { ready, loadError };
}
