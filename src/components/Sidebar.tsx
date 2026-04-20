import logo from "../assets/logo.png";
import { useAuth } from "../lib/auth";
import { canAccessRoute } from "../lib/permissions";
import { navigate, useRoute } from "../lib/router";
import type { ThemeMode } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";

const sections = [
  { label: "Primary", items: [{ path: "/", name: "Dashboard" }, { path: "/sales", name: "Sale Stats" }, { path: "/tracker", name: "Tracker" }, { path: "/live", name: "Live Classes" }, { path: "/webinars", name: "Webinars" }] },
  { label: "Catalog", items: [{ path: "/teachers", name: "Teachers" }, { path: "/products", name: "Products" }, { path: "/bootcamps", name: "Bootcamps" }] },
  { label: "Operations", items: [{ path: "/students", name: "Students" }, { path: "/orders", name: "Orders" }, { path: "/payments", name: "Payments" }, { path: "/exports", name: "Exports" }, { path: "/marketing", name: "Marketing" }, { path: "/operations", name: "Operations" }, { path: "/onboarding", name: "BDA Onboarding" }, { path: "/refunds", name: "Refunds" }, { path: "/team", name: "Team" }, { path: "/links", name: "Links" }, { path: "/settings", name: "Settings" }] },
];

export function Sidebar({
  collapsed,
  onToggle,
  theme,
  onToggleTheme,
}: {
  collapsed: boolean;
  onToggle: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const route = useRoute();
  const { user, logout } = useAuth();
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessRoute(user, item.path)),
    }))
    .filter((section) => section.items.length);

  return (
    <aside className={`sidebar-shell hidden h-full shrink-0 flex-col rounded-[28px] p-3 backdrop-blur transition-[width] duration-200 lg:flex ${collapsed ? "w-[92px]" : "w-[292px]"}`}>
      <div className={`sidebar-panel mb-4 rounded-[24px] ${collapsed ? "px-2 py-3" : "px-4 py-4"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className={collapsed ? "flex justify-center" : ""}>
            <img src={logo} alt="Livelong Wealth" className={`${collapsed ? "h-10" : "h-14"} w-auto object-contain`} />
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="sidebar-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="sidebar-toggle-bar" />
          </button>
        </div>

        {!collapsed ? (
          <>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-strong)]">Admin OS</h1>
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Workspace for operations, payments, webinars, and analytics.</p>
            {user ? (
              <div className="sidebar-user-card mt-4 rounded-2xl px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-role)]">{user.role || "Google User"}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{user.name}</p>
                <p className="mt-1 break-all text-xs text-[var(--text-secondary)]">{user.email}</p>
              </div>
            ) : null}
            <div className="mt-4">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            </div>
          </>
        ) : (
          <div className="mt-4 flex justify-center">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
          </div>
        )}
      </div>

      <div className={`flex-1 space-y-6 overflow-y-auto ${collapsed ? "px-1" : "pr-1"}`}>
        {visibleSections.map((section) => (
          <div key={section.label}>
            {!collapsed ? <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{section.label}</p> : null}
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = route.pattern === item.path;
                const badge = item.path === "/" ? "HM" : item.name.slice(0, 2).toUpperCase();
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={`sidebar-link ${collapsed ? "justify-center px-2 py-3" : "justify-between px-3 py-2.5"} ${active ? "sidebar-link-active" : "sidebar-link-idle"}`}
                    title={collapsed ? item.name : undefined}
                  >
                    {collapsed ? (
                      <span className="sidebar-collapsed-badge">{badge}</span>
                    ) : (
                      <>
                        <span>{item.name}</span>
                        <span className="font-mono text-xs opacity-60 mix-blend-multiply">{item.path === "/" ? "home" : item.path.replace("/", "")}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={logout}
        className={`sidebar-logout mt-4 w-full rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${collapsed ? "text-center" : "text-left"}`}
        title={collapsed ? "Logout" : undefined}
      >
        {collapsed ? "LO" : "Logout"}
      </button>
    </aside>
  );
}
