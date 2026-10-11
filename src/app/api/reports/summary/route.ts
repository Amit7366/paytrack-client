import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin", "admin");
    const url = new URL(request.url);
    return proxyApi(`/reports/summary?${url.searchParams.toString()}`);
  } catch (error) {
    return authJson(error);
  }
}
