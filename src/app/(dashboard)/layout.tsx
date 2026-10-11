import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("super_admin", "admin", "user");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
