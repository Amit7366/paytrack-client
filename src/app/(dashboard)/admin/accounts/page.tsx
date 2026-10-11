import AccountsTable from "@/components/accounts-table";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function AdminAccountsPage() {
  await requireRole("admin");
  return <AccountsTable canEdit={false} />;
}
