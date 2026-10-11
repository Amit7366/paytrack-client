import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    await requireRole("super_admin", "admin");
    const { id } = await context.params;
    return proxyApi(`/payments/${encodeURIComponent(id)}/mark-unpaid`, { method: "POST" });
  } catch (error) {
    return authJson(error);
  }
}
