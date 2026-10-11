import { ReportDashboard } from "@/components/reports/report-dashboard";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function SuperAdminPage() {
  await requireRole("super_admin");
  return (
    <ReportDashboard
      title="Super admin control"
      description="Platform USD and BDT totals. Figures are calculated on the server."
    />
  );
}
