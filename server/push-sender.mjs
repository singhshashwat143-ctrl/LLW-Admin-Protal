// Web Push sender — thin wrapper around the `web-push` library + VAPID config.
//
// VAPID keys come from the environment (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
// The public key is also served to the browser so the registration page can
// subscribe. If keys are missing the module reports itself disabled and every
// send is a no-op (so a mis-configured deploy never crashes — it just doesn't
// send reminders, and the status endpoint makes that visible).

let webpush = null;
let enabled = false;
let publicKey = "";

const subject =
  String(process.env.VAPID_SUBJECT || "").trim() ||
  (process.env.PUBLIC_APP_URL ? String(process.env.PUBLIC_APP_URL).trim() : "") ||
  "https://analytx.livelongwealth.in";

export async function configurePush() {
  publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();

  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys not configured — reminder push notifications are DISABLED.");
    enabled = false;
    return { enabled: false };
  }

  try {
    const mod = await import("web-push");
    webpush = mod.default || mod;
    webpush.setVapidDetails(subject.startsWith("http") || subject.startsWith("mailto:") ? subject : `mailto:${subject}`, publicKey, privateKey);
    enabled = true;
    console.log("[push] Web Push configured (VAPID subject:", subject, ")");
    return { enabled: true };
  } catch (error) {
    console.error("[push] Failed to configure web-push:", error?.message || error);
    enabled = false;
    return { enabled: false };
  }
}

export function isPushEnabled() {
  return enabled;
}

export function getPublicKey() {
  return publicKey;
}

// Sends one notification. On success resolves { ok: true }. On an expired /
// unsubscribed endpoint (404/410) resolves { ok: false, gone: true } so the
// caller can prune the dead subscription. Other errors resolve { ok: false }.
export async function sendPush(subscription, payload) {
  if (!enabled || !webpush) {
    return { ok: false, disabled: true };
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    const status = error?.statusCode;
    if (status === 404 || status === 410) {
      return { ok: false, gone: true };
    }
    return { ok: false, error: error?.message || String(error), status };
  }
}
