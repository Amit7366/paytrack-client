import { SettingsForm } from "@/components/settings-form";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function AdminSettingsPage() {
  const user = await requireRole("admin");
  return <SettingsForm user={user} />;
}
