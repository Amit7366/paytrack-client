import { PaymentsManager } from "@/components/payments-manager";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function AdminPaymentsPage() {
  await requireRole("admin", "super_admin");
  return <PaymentsManager />;
}
