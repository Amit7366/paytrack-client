import { ReportsManager } from "@/components/reports/reports-manager";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function ReportsPage() {
  await requireRole("admin", "super_admin");
  return <ReportsManager />;
}
