import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireRole("super_admin", "admin", "user");
    const { id } = await context.params;
    const url = new URL(request.url);
    return proxyApi(`/reports/user/${encodeURIComponent(id)}?${url.searchParams.toString()}`);
  } catch (error) {
    return authJson(error);
  }
}
