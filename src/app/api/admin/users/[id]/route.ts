import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";
import { updateManagedUserSchema } from "@/lib/validations/managed-user";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireRole("admin", "super_admin");
    const { id } = await context.params;
    return proxyApi(`/admin/users/${encodeURIComponent(id)}`);
  } catch (error) {
    return authJson(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireRole("admin", "super_admin");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateManagedUserSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", 422, parsed.error.flatten());
    }
    return proxyApi(`/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return authJson(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireRole("admin", "super_admin");
    const { id } = await context.params;
    return proxyApi(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    return authJson(error);
  }
}
