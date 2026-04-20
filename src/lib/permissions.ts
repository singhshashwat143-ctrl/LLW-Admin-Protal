export type AppRole = "SUPER_ADMIN" | "ADMIN" | "BDM" | "OPERATIONS" | "MARKETING" | "BDA";
export type AppPermission =
  | "export_data"
  | "review_refunds"
  | "approve_refunds"
  | "view_team_dashboard"
  | "view_links_admin"
  | "view_settings"
  | "manage_operations"
  | "manage_marketing";

type UserLike = {
  role?: string | null;
};

const rolePermissions: Record<AppRole, AppPermission[]> = {
  SUPER_ADMIN: [
    "export_data",
    "review_refunds",
    "approve_refunds",
    "view_team_dashboard",
    "view_links_admin",
    "view_settings",
    "manage_operations",
    "manage_marketing",
  ],
  ADMIN: [
    "export_data",
    "review_refunds",
    "approve_refunds",
    "view_team_dashboard",
    "view_links_admin",
    "view_settings",
    "manage_operations",
    "manage_marketing",
  ],
  BDM: [
    "export_data",
    "view_team_dashboard",
    "view_settings",
  ],
  OPERATIONS: [
    "manage_operations",
  ],
  MARKETING: [
    "manage_marketing",
  ],
  BDA: [
    "view_team_dashboard",
  ],
};

const routePermissions: Partial<Record<string, AppPermission>> = {
  "/exports": "export_data",
  "/refunds": "review_refunds",
  "/team": "view_team_dashboard",
  "/links": "view_links_admin",
  "/settings": "view_settings",
  "/operations": "manage_operations",
  "/marketing": "manage_marketing",
};

export function normalizeRole(role?: string | null): AppRole {
  const normalized = String(role || "BDA").toUpperCase();
  if (normalized === "SUPER_ADMIN" || normalized === "ADMIN" || normalized === "BDM" || normalized === "OPERATIONS" || normalized === "MARKETING") return normalized;
  return "BDA";
}

export function hasPermission(user: UserLike | null | undefined, permission: AppPermission) {
  const role = normalizeRole(user?.role);
  return rolePermissions[role].includes(permission);
}

export function canAccessRoute(user: UserLike | null | undefined, path: string) {
  const requiredPermission = routePermissions[path];
  if (!requiredPermission) return true;
  return hasPermission(user, requiredPermission);
}

export function getRouteRestrictionCopy(path: string) {
  if (path === "/exports") {
    return {
      title: "Data exports are restricted",
      description: "BDA accounts cannot export data. BDM accounts can export only their own team data.",
    };
  }
  if (path === "/refunds") {
    return {
      title: "Refund approvals are restricted",
      description: "BDA accounts can raise refund requests from the payment desk, but only admin-level users can review and approve them.",
    };
  }
  if (path === "/operations") {
    return {
      title: "Operations access only",
      description: "This section is limited to operations, admin, and super-admin accounts.",
    };
  }
  if (path === "/marketing") {
    return {
      title: "Marketing access only",
      description: "This section is limited to marketing, admin, and super-admin accounts.",
    };
  }
  if (path === "/links" || path === "/settings") {
    return {
      title: "This admin area is restricted",
      description: "This section is limited to the roles that manage these tools.",
    };
  }
  return {
    title: "Access restricted",
    description: "Your current role does not have access to this area.",
  };
}
