import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";
import { createAdminSchema, listAdminsSchema } from "@/lib/validations/admin";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin");
    const url = new URL(request.url);
    const parsed = listAdminsSchema.safeParse({
      search: url.searchParams.get("search") ?? "",
      page: url.searchParams.get("page") ?? "1",
      limit: url.searchParams.get("limit") ?? "10",
    });
    if (!parsed.success) {
      return apiError("Validation failed", 422, parsed.error.flatten());
    }
    const params = new URLSearchParams({
      search: parsed.data.search,
      page: String(parsed.data.page),
      limit: String(parsed.data.limit),
    });
    return proxyApi(`/super-admin/admins?${params.toString()}`);
  } catch (error) {
    return authJson(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("super_admin");
    const body = await request.json().catch(() => null);
    const parsed = createAdminSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", 422, parsed.error.flatten());
    }
    return proxyApi("/super-admin/admins", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return authJson(error);
  }
}
