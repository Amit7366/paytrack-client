import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";

export const instant = false;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  redirect(user ? homeForRole(user.role) : "/login");
}
