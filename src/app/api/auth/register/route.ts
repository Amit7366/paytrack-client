import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  try {
    await requireRole("super_admin");
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Validation failed", 422, parsed.error.flatten());
    }
    return proxyApi("/auth/register", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return authJson(error);
  }
}
