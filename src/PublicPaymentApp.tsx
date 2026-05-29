import { useEffect, useState } from "react";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicy";
import { PaymentCheckoutPage, SubscriptionCheckoutPage } from "./pages/PublicPayments";

function resolvePublicRoute(pathname: string) {
  if (pathname === "/privacy-policy") {
    return { pattern: "/privacy-policy", params: {} as Record<string, string> };
  }

  const paymentMatch = pathname.match(/^\/payment\/([^/]+)$/);
  if (paymentMatch) {
    return { pattern: "/payment/:id", params: { id: decodeURIComponent(paymentMatch[1]) } };
  }

  const subscriptionMatch = pathname.match(/^\/subscription\/([^/]+)$/);
  if (subscriptionMatch) {
    return { pattern: "/subscription/:id", params: { id: decodeURIComponent(subscriptionMatch[1]) } };
  }

  return { pattern: "not-found", params: {} as Record<string, string> };
}

export default function PublicPaymentApp() {
  const [route, setRoute] = useState(() => resolvePublicRoute(window.location.pathname));

  useEffect(() => {
    const onChange = () => setRoute(resolvePublicRoute(window.location.pathname));
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  if (route.pattern === "/payment/:id") {
    return <PaymentCheckoutPage id={route.params.id} />;
  }

  if (route.pattern === "/subscription/:id") {
    return <SubscriptionCheckoutPage id={route.params.id} />;
  }

  if (route.pattern === "/privacy-policy") {
    return <PrivacyPolicyPage />;
  }

  return <div className="min-h-screen bg-slate-50" />;
}
