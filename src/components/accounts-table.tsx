import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole, type CurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/roles";
import { SESSION_COOKIE, type SessionRole } from "@/lib/session";
import { updateRoleSchema } from "@/lib/validations/auth";

const loadUsers = async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const response = await fetch(`${process.env.API_URL ?? "http://localhost:4000/api"}/users`, {
    headers: { cookie: `${SESSION_COOKIE}=${token ?? ""}` },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: CurrentUser[] };
  return (payload.data ?? []).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  }));
};

async function updateRole(formData: FormData) {
  "use server";
  await requireRole("super_admin");
  const parsed = updateRoleSchema.safeParse({
    id: formData.get("id"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await fetch(`${process.env.API_URL ?? "http://localhost:4000/api"}/users/${parsed.data.id}/role`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE}=${token ?? ""}`,
    },
    body: JSON.stringify({ role: parsed.data.role }),
    cache: "no-store",
  });
  revalidatePath("/super-admin/accounts");
}

export default async function AccountsPage({ canEdit }: { canEdit: boolean }) {
  const users = await loadUsers();
  const roles: SessionRole[] = ["super_admin", "admin", "user"];

  return (
    <section>
      <h1 className="text-2xl font-semibold">Accounts</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {canEdit ? "Super admins can change roles." : "Admins can review accounts."}
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  {canEdit ? (
                    <form action={updateRole} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <select name="role" defaultValue={user.role} className="h-8 rounded-lg border bg-background px-2">
                        {roles.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="text-sm underline underline-offset-4">
                        Save
                      </button>
                    </form>
                  ) : (
                    ROLE_LABELS[user.role]
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
