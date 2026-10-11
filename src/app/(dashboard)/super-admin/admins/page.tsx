import { AdminsManager } from "@/components/admins-manager";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function SuperAdminAdminsPage() {
  await requireRole("super_admin");
  return <AdminsManager />;
}
