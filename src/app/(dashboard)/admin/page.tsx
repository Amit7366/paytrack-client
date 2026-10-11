import { AdminDesk } from "@/components/admin-desk";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function AdminPage() {
  const user = await requireRole("admin");
  return <AdminDesk operator={user.name} />;
}
