import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";
import { updateAdminSchema } from "@/lib/validations/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireRole("super_admin");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateAdminSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", 422, parsed.error.flatten());
    }
    return proxyApi(`/super-admin/admins/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return authJson(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireRole("super_admin");
    const { id } = await context.params;
    if (!id) {
      return apiError("Admin id is required", 422);
    }
    return proxyApi(`/super-admin/admins/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    return authJson(error);
  }
}
