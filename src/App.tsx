import { Suspense, lazy, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { AccessDenied } from "./components/AccessDenied";
import { LoginGate } from "./components/LoginGate";
import { Sidebar } from "./components/Sidebar";
import type { ThemeMode } from "./lib/theme";
import { useAuth } from "./lib/auth";
import { canAccessRoute, getRouteRestrictionCopy, hasPermission } from "./lib/permissions";
import { navigate, useRoute } from "./lib/router";
import { persistTheme, resolvePreferredTheme } from "./lib/theme";

// Pages are lazy-loaded so each route ships its own chunk. This keeps the heavy
// admin code (LiveKit, socket.io, dashboards) out of the customer-facing
// payment/subscription pages, which otherwise had to download the whole app.
function lazyNamed<M, K extends keyof M>(loader: () => Promise<M>, name: K) {
  return lazy(() => loader().then((module) => ({ default: module[name] as ComponentType<any> })));
}

const Bootcamps = () => import("./pages/Bootcamps");
const Live = () => import("./pages/Live");
const Payments = () => import("./pages/Payments");
const Webinars = () => import("./pages/Webinars");

const BootcampLandingPage = lazyNamed(Bootcamps, "BootcampLandingPage");
const BootcampListPage = lazyNamed(Bootcamps, "BootcampListPage");
const BootcampFormPage = lazyNamed(Bootcamps, "BootcampFormPage");
const DashboardPage = lazyNamed(() => import("./pages/Dashboard"), "DashboardPage");
const ExportsPage = lazyNamed(() => import("./pages/Exports"), "ExportsPage");
const InstructorsPage = lazyNamed(() => import("./pages/Instructors"), "InstructorsPage");
const LinksPage = lazyNamed(() => import("./pages/Links"), "LinksPage");
const LiveClassesPage = lazyNamed(Live, "LiveClassesPage");
const WebinarDetailPage = lazyNamed(Live, "WebinarDetailPage");
const WebinarAttendPage = lazyNamed(Live, "WebinarAttendPage");
const WebinarHostPage = lazyNamed(Live, "WebinarHostPage");
const MarketingPage = lazyNamed(() => import("./pages/Marketing"), "MarketingPage");
const OrdersPage = lazyNamed(() => import("./pages/Orders"), "OrdersPage");
const OperationsPage = lazyNamed(() => import("./pages/Operations"), "OperationsPage");
const PaymentImportsPage = lazyNamed(() => import("./pages/PaymentImports"), "PaymentImportsPage");
const PaymentCheckoutPage = lazyNamed(Payments, "PaymentCheckoutPage");
const PaymentsPage = lazyNamed(Payments, "PaymentsPage");
const SubscriptionCheckoutPage = lazyNamed(Payments, "SubscriptionCheckoutPage");
const SubscriptionPaymentsPage = lazyNamed(Payments, "SubscriptionPaymentsPage");
const PrivacyPolicyPage = lazyNamed(() => import("./pages/PrivacyPolicy"), "PrivacyPolicyPage");
const OnboardingPage = lazyNamed(() => import("./pages/Onboarding"), "OnboardingPage");
const ProductsPage = lazyNamed(() => import("./pages/Products"), "ProductsPage");
const RefundsPage = lazyNamed(() => import("./pages/Refunds"), "RefundsPage");
const SaleStatsPage = lazyNamed(() => import("./pages/SaleStats"), "SaleStatsPage");
const SettingsPage = lazyNamed(() => import("./pages/Settings"), "SettingsPage");
const StudentsPage = lazyNamed(() => import("./pages/Students"), "StudentsPage");
const TeamPage = lazyNamed(() => import("./pages/Team"), "TeamPage");
const DailyTrackerPage = lazyNamed(() => import("./pages/Tracker"), "DailyTrackerPage");
const MasterclassLandingPage = lazyNamed(Webinars, "MasterclassLandingPage");
const WebinarFormPage = lazyNamed(Webinars, "WebinarFormPage");
const WebinarsPage = lazyNamed(Webinars, "WebinarsPage");

function RouteFallback() {
  return <div className="min-h-screen bg-[var(--bg-primary)]" />;
}

function AdminLayout({
  children,
  theme,
  onToggleTheme,
  showLinksShortcut,
  linksShortcutActive,
}: {
  children: ReactNode;
  theme: ThemeMode;
  onToggleTheme: () => void;
  showLinksShortcut: boolean;
  linksShortcutActive: boolean;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-shell h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto flex h-screen max-w-[1600px] gap-4 px-3 py-4 md:px-4">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            {showLinksShortcut ? (
              <div className="pb-3">
                <div className="glass-card flex flex-col gap-4 rounded-2xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Quick Access</p>
                    <p className="mt-1 text-base font-semibold text-[var(--text-strong)]">PyMD link publishing</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Open the link manager and create a short link from one clear button.</p>
                  </div>
                  <button
                    className={linksShortcutActive ? "btn-secondary shrink-0" : "btn-primary shrink-0"}
                    type="button"
                    onClick={() => navigate("/links")}
                  >
                    {linksShortcutActive ? "PyMD Links Open" : "Open PyMD Links"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="admin-content-scroll min-h-0 flex-1">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const { ready, user } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>(() => resolvePreferredTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    persistTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  const publicRoute = (node: ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>;

  if (route.pattern === "/webinar/attend/:roomName") {
    return publicRoute(<WebinarAttendPage roomName={route.params.roomName} />);
  }

  if (route.pattern === "/webinar/host/:roomName") {
    return publicRoute(<WebinarHostPage roomName={route.params.roomName} />);
  }

  if (route.pattern === "/payment/:id") {
    return publicRoute(<PaymentCheckoutPage id={route.params.id} />);
  }

  if (route.pattern === "/subscription/:id") {
    return publicRoute(<SubscriptionCheckoutPage id={route.params.id} />);
  }

  if (route.pattern === "/privacy-policy") {
    return publicRoute(<PrivacyPolicyPage />);
  }

  if (route.pattern === "/masterclass/:slug") {
    return publicRoute(<MasterclassLandingPage slug={route.params.slug} />);
  }

  if (route.pattern === "/bootcamp/:slug") {
    return publicRoute(<BootcampLandingPage slug={route.params.slug} />);
  }

  if (!ready) {
    return <div className="min-h-screen bg-[var(--bg-primary)]" />;
  }

  if (!user) {
    return <LoginGate theme={theme} onToggleTheme={toggleTheme} />;
  }

  const routeRestriction = canAccessRoute(user, route.pattern) ? null : getRouteRestrictionCopy(route.pattern);
  const showLinksShortcut = hasPermission(user, "view_links_admin");

  return (
    <AdminLayout
      theme={theme}
      onToggleTheme={toggleTheme}
      showLinksShortcut={showLinksShortcut}
      linksShortcutActive={route.pattern === "/links"}
    >
      {routeRestriction ? <AccessDenied title={routeRestriction.title} description={routeRestriction.description} /> : null}
      {!routeRestriction && (
        <Suspense fallback={<RouteFallback />}>
          {route.pattern === "/" && <DashboardPage />}
          {route.pattern === "/sales" && <SaleStatsPage />}
          {route.pattern === "/tracker" && <DailyTrackerPage />}
          {route.pattern === "/live" && <LiveClassesPage />}
          {route.pattern === "/live/:id" && <WebinarDetailPage id={route.params.id} />}
          {route.pattern === "/bootcamps" && <BootcampListPage />}
          {(route.pattern === "/bootcamps/new" || route.pattern === "/bootcamps/:id/edit") && <BootcampFormPage id={route.params.id} />}
          {route.pattern === "/webinars" && <WebinarsPage />}
          {route.pattern === "/webinars/new" && <WebinarFormPage />}
          {route.pattern === "/payments" && <PaymentsPage />}
          {route.pattern === "/payments/subscriptions" && <SubscriptionPaymentsPage />}
          {route.pattern === "/payments/import" && <PaymentImportsPage />}
          {route.pattern === "/marketing" && <MarketingPage />}
          {route.pattern === "/exports" && <ExportsPage />}
          {route.pattern === "/operations" && <OperationsPage />}
          {route.pattern === "/refunds" && <RefundsPage />}
          {route.pattern === "/teachers" && <InstructorsPage />}
          {route.pattern === "/products" && <ProductsPage />}
          {route.pattern === "/students" && <StudentsPage />}
          {route.pattern === "/orders" && <OrdersPage />}
          {route.pattern === "/onboarding" && <OnboardingPage />}
          {route.pattern === "/team" && <TeamPage />}
          {route.pattern === "/links" && <LinksPage />}
          {route.pattern === "/settings" && <SettingsPage />}
        </Suspense>
      )}
    </AdminLayout>
  );
}
