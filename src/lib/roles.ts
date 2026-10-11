import type { SessionRole } from "./session";

export const ROLE_LABELS: Record<SessionRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  user: "User",
};

export const homeForRole = (role: SessionRole) => {
  if (role === "super_admin") return "/super-admin";
  if (role === "admin") return "/admin";
  return "/user";
};

export const navForRole = (role: SessionRole) => {
  if (role === "super_admin") {
    return [
      { href: "/super-admin", label: "Overview" },
      { href: "/super-admin/admins", label: "Admins" },
      { href: "/super-admin/audit-logs", label: "Audit logs" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/reports", label: "Reports" },
      { href: "/super-admin/accounts", label: "Accounts" },
      { href: "/super-admin/settings", label: "Settings" },
    ];
  }
  if (role === "admin") {
    return [
      { href: "/admin", label: "Overview" },
      { href: "/admin/users", label: "Users" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/reports", label: "Reports" },
      { href: "/admin/accounts", label: "Accounts" },
      { href: "/admin/settings", label: "Settings" },
    ];
  }
  return [
    { href: "/user", label: "Overview" },
    { href: "/user/payments", label: "Payments" },
    { href: "/user/settings", label: "Settings" },
  ];
};
