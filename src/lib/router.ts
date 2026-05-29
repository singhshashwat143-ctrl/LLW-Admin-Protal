import { useEffect, useState } from "react";

const routes = [
  "/",
  "/sales",
  "/tracker",
  "/live",
  "/live/:id",
  "/bootcamps",
  "/bootcamps/new",
  "/bootcamps/:id/edit",
  "/webinars",
  "/webinars/new",
  "/payments",
  "/payments/subscriptions",
  "/payments/import",
  "/exports",
  "/operations",
  "/refunds",
  "/teachers",
  "/products",
  "/students",
  "/orders",
  "/onboarding",
  "/team",
  "/links",
  "/settings",
  "/webinar/attend/:roomName",
  "/webinar/host/:roomName",
  "/payment/:id",
  "/subscription/:id",
  "/privacy-policy",
  "/masterclass/:slug",
  "/bootcamp/:slug",
];

function matchPattern(pattern: string, pathname: string) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (pattern === "/" && pathname === "/") {
    return { matched: true, params: {} as Record<string, string> };
  }

  if (patternParts.length !== pathParts.length) {
    return { matched: false, params: {} as Record<string, string> };
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }
    if (patternPart !== pathPart) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

function resolveRoute(pathname: string) {
  for (const pattern of routes) {
    const attempt = matchPattern(pattern, pathname);
    if (attempt.matched) {
      return { pattern, pathname, params: attempt.params };
    }
  }
  return { pattern: "/", pathname: "/", params: {} as Record<string, string> };
}

export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute() {
  const [route, setRoute] = useState(() => resolveRoute(window.location.pathname));

  useEffect(() => {
    const onChange = () => setRoute(resolveRoute(window.location.pathname));
    window.addEventListener("popstate", onChange);
    return () => window.removeEventListener("popstate", onChange);
  }, []);

  return route;
}
