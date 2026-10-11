import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";
import { createManagedUserSchema, listManagedUsersSchema } from "@/lib/validations/managed-user";

export async function GET(request: Request) {
  try {
    await requireRole("admin", "super_admin");
    const url = new URL(request.url);
    const parsed = listManagedUsersSchema.safeParse({
      search: url.searchParams.get("search") ?? "",
      status: url.searchParams.get("status") ?? "all",
      page: url.searchParams.get("page") ?? "1",
      limit: url.searchParams.get("limit") ?? "10",
    });
    if (!parsed.success) {
      return apiError("Validation failed", 422, parsed.error.flatten());
    }
    const params = new URLSearchParams({
      search: parsed.data.search,
      status: parsed.data.status,
      page: String(parsed.data.page),
      limit: String(parsed.data.limit),
    });
    return proxyApi(`/admin/users?${params.toString()}`);
  } catch (error) {
    return authJson(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("admin", "super_admin");
    const body = await request.json().catch(() => null);
    const parsed = createManagedUserSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", 422, parsed.error.flatten());
    }
    return proxyApi("/admin/users", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return authJson(error);
  }
}
