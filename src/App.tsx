import { useEffect, useState, type ReactNode } from "react";
import { AccessDenied } from "./components/AccessDenied";
import { LoginGate } from "./components/LoginGate";
import { Sidebar } from "./components/Sidebar";
import type { ThemeMode } from "./lib/theme";
import { useAuth } from "./lib/auth";
import { canAccessRoute, getRouteRestrictionCopy } from "./lib/permissions";
import { useRoute } from "./lib/router";
import { persistTheme, resolvePreferredTheme } from "./lib/theme";
import { BootcampLandingPage, BootcampListPage, BootcampFormPage } from "./pages/Bootcamps";
import { DashboardPage } from "./pages/Dashboard";
import { ExportsPage } from "./pages/Exports";
import { InstructorsPage } from "./pages/Instructors";
import { LinksPage } from "./pages/Links";
import { LiveClassesPage, WebinarDetailPage, WebinarAttendPage, WebinarHostPage } from "./pages/Live";
import { MarketingPage } from "./pages/Marketing";
import { OrdersPage } from "./pages/Orders";
import { OperationsPage } from "./pages/Operations";
import { PaymentCheckoutPage, PaymentsPage } from "./pages/Payments";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicy";
import { OnboardingPage } from "./pages/Onboarding";
import { ProductsPage } from "./pages/Products";
import { RefundsPage } from "./pages/Refunds";
import { SaleStatsPage } from "./pages/SaleStats";
import { SettingsPage } from "./pages/Settings";
import { StudentsPage } from "./pages/Students";
import { TeamPage } from "./pages/Team";
import { DailyTrackerPage } from "./pages/Tracker";
import { MasterclassLandingPage, WebinarFormPage, WebinarsPage } from "./pages/Webinars";

function AdminLayout({
  children,
  theme,
  onToggleTheme,
}: {
  children: ReactNode;
  theme: ThemeMode;
  onToggleTheme: () => void;
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
          <div className="admin-content-scroll h-full">{children}</div>
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

  if (route.pattern === "/webinar/attend/:roomName") {
    return <WebinarAttendPage roomName={route.params.roomName} />;
  }

  if (route.pattern === "/webinar/host/:roomName") {
    return <WebinarHostPage roomName={route.params.roomName} />;
  }

  if (route.pattern === "/payment/:id") {
    return <PaymentCheckoutPage id={route.params.id} />;
  }

  if (route.pattern === "/privacy-policy") {
    return <PrivacyPolicyPage />;
  }

  if (route.pattern === "/masterclass/:slug") {
    return <MasterclassLandingPage slug={route.params.slug} />;
  }

  if (route.pattern === "/bootcamp/:slug") {
    return <BootcampLandingPage slug={route.params.slug} />;
  }

  if (!ready) {
    return <div className="min-h-screen bg-[var(--bg-primary)]" />;
  }

  if (!user) {
    return <LoginGate theme={theme} onToggleTheme={toggleTheme} />;
  }

  const routeRestriction = canAccessRoute(user, route.pattern) ? null : getRouteRestrictionCopy(route.pattern);

  return (
    <AdminLayout theme={theme} onToggleTheme={toggleTheme}>
      {routeRestriction ? <AccessDenied title={routeRestriction.title} description={routeRestriction.description} /> : null}
      {!routeRestriction && (
        <>
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
        </>
      )}
    </AdminLayout>
  );
}
