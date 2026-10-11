import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin", "admin", "user");
    const query = new URL(request.url).searchParams.toString();
    return proxyApi(`/search?${query}`);
  } catch (error) {
    return authJson(error);
  }
}
