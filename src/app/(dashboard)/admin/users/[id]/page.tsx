import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { UserReport } from "@/components/reports/user-report";
import type { ManagedUser } from "@/components/users-manager";
import { requireRole } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/session";

export const instant = false;

async function loadUser(id: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000/api"}/admin/users/${id}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token ?? ""}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: ManagedUser };
  return payload.data ?? null;
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin", "super_admin");
  const { id } = await params;
  const user = await loadUser(id);
  if (!user) notFound();
  return <UserReport user={user} />;
}
