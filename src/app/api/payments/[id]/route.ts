import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";
import { paymentFieldsSchema } from "@/lib/validations/payment";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireRole("super_admin", "admin");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = paymentFieldsSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Validation failed", 422, parsed.error.flatten());
    }
    const payload = { ...parsed.data } as Record<string, unknown>;
    if (typeof payload.paymentDate === "string" && payload.paymentDate) {
      payload.paymentDate = new Date(`${payload.paymentDate}T12:00:00`).toISOString();
    }
    return proxyApi(`/payments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return authJson(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireRole("super_admin", "admin");
    const { id } = await context.params;
    return proxyApi(`/payments/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    return authJson(error);
  }
}
