import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";

export async function GET() {
  try {
    await requireRole("super_admin");
    return proxyApi("/super-admin/stats");
  } catch (error) {
    return authJson(error);
  }
}
