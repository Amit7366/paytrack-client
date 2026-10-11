import AccountsTable from "@/components/accounts-table";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function SuperAdminAccountsPage() {
  await requireRole("super_admin");
  return <AccountsTable canEdit />;
}
