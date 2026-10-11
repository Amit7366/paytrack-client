import { SettingsForm } from "@/components/settings-form";
import { requireRole } from "@/lib/auth";

export const instant = false;

export default async function UserSettingsPage() {
  const user = await requireRole("user");
  return <SettingsForm user={user} />;
}
