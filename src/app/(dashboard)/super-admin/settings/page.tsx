import { SettingsForm } from "@/components/settings-form";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function SuperAdminSettingsPage() {
  const user = await requireRole("super_admin");
  return <SettingsForm user={user} />;
}
