import { requireRole } from "@/lib/auth";
import { UsersManager } from "@/components/users-manager";

export const instant = false;

export default async function AdminUsersPage() {
  await requireRole("admin", "super_admin");
  return <UsersManager />;
}
