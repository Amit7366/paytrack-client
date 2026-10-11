import { AuditLogViewer } from "@/components/audit-log-viewer";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function AuditLogsPage() {
  await requireRole("super_admin");
  return <AuditLogViewer />;
}
