// Five masterclass logo marks. Swap the primary by changing DEFAULT_MASTERCLASS_LOGO.
// Each mark works in one colour, on light or dark, and scales to a favicon.
export type MasterclassLogoVariant = 1 | 2 | 3 | 4 | 5;

// The active mark used across the live masterclass surfaces. Change this to
// switch every logo at once (1 Decay Hex · 2 Payoff X · 3 Ascend Candles ·
// 4 Aegis Yield · 5 CX Monogram).
export const DEFAULT_MASTERCLASS_LOGO: MasterclassLogoVariant = 1;

const ORANGE = "#F7931A";
const INK = "#161C2D";
const SOFT = "#FFF3E4";

export function MasterclassMark({
  variant = DEFAULT_MASTERCLASS_LOGO,
  size = 48,
  onDark = false,
}: {
  variant?: MasterclassLogoVariant;
  size?: number;
  onDark?: boolean;
}) {
  const line = onDark ? "#FFFFFF" : INK;
  const fillSoft = onDark ? "rgba(255,255,255,0.06)" : SOFT;
  const common = { width: size, height: size, viewBox: "0 0 48 48", "aria-hidden": true as const };

  if (variant === 2) {
    return (
      <svg {...common}>
        <circle cx="24" cy="24" r="20" fill={onDark ? "#0F1420" : INK} />
        <path d="M9 33 L20 19 M28 19 L39 33" stroke={ORANGE} strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <path d="M9 15 L20 29 M28 29 L39 15" stroke="#FFFFFF" strokeWidth="3.2" fill="none" strokeLinecap="round" opacity="0.9" />
      </svg>
    );
  }
  if (variant === 3) {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="38" height="38" rx="11" fill={INK} />
        <line x1="15" y1="33" x2="15" y2="23" stroke={ORANGE} strokeWidth="2" />
        <rect x="12" y="26" width="6" height="7" rx="1.4" fill={ORANGE} />
        <line x1="24" y1="31" x2="24" y2="17" stroke="#FFFFFF" strokeWidth="2" />
        <rect x="21" y="21" width="6" height="9" rx="1.4" fill="#FFFFFF" />
        <line x1="33" y1="28" x2="33" y2="12" stroke={ORANGE} strokeWidth="2" />
        <rect x="30" y="16" width="6" height="10" rx="1.4" fill={ORANGE} />
        <path d="M31 13 L33 9 L35 13" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === 4) {
    return (
      <svg {...common}>
        <path d="M24 4 L40 10 V23 C40 33 33 40 24 44 C15 40 8 33 8 23 V10 Z" fill={fillSoft} stroke={ORANGE} strokeWidth="2.6" strokeLinejoin="round" />
        <path d="M14 29 L21 23 L27 27 L36 16" fill="none" stroke={line} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="36" cy="16" r="2.6" fill={ORANGE} />
      </svg>
    );
  }
  if (variant === 5) {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="40" height="40" rx="13" fill={ORANGE} />
        <path d="M30 16 A11 11 0 1 0 30 32" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M27 18 L37 32 M37 18 L27 32" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    );
  }
  // variant 1 — Decay Hex (default)
  return (
    <svg {...common}>
      <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" fill={fillSoft} stroke={ORANGE} strokeWidth="2.6" />
      <path d="M11 32 C21 32 25 17 37 15" fill="none" stroke={line} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="37" cy="15" r="3" fill={ORANGE} />
    </svg>
  );
}

export function MasterclassWordmark({
  variant = DEFAULT_MASTERCLASS_LOGO,
  size = 44,
  onDark = false,
}: {
  variant?: MasterclassLogoVariant;
  size?: number;
  onDark?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <MasterclassMark variant={variant} size={size} onDark={onDark} />
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontWeight: 800, fontSize: size * 0.42, letterSpacing: "-0.02em", color: onDark ? "#FFFFFF" : INK }}>CryptX</div>
        <div style={{ fontWeight: 600, fontSize: size * 0.2, letterSpacing: "0.28em", color: onDark ? "#8A93A6" : "#8A93A6", marginTop: 4 }}>MASTERCLASS</div>
      </div>
    </div>
  );
}
