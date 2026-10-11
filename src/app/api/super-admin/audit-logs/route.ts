import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin");
    const url = new URL(request.url);
    return proxyApi(`/super-admin/audit-logs?${url.searchParams.toString()}`);
  } catch (error) {
    return authJson(error);
  }
}
