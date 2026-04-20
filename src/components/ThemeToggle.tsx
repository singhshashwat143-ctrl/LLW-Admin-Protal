import type { ThemeMode } from "../lib/theme";

export function ThemeToggle({
  theme,
  onToggle,
  compact = false,
}: {
  theme: ThemeMode;
  onToggle: () => void;
  compact?: boolean;
}) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`theme-toggle ${compact ? "theme-toggle-compact" : ""}`}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {theme === "dark" ? "☀︎" : "☾"}
      </span>
      {!compact ? (
        <span className="theme-toggle-copy">
          <span className="theme-toggle-label">{theme === "dark" ? "Dark mode" : "Light mode"}</span>
          <span className="theme-toggle-hint">Switch to {nextTheme}</span>
        </span>
      ) : null}
    </button>
  );
}
