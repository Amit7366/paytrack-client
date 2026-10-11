import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";

const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });

export async function POST(request: Request) {
  try {
    await requireRole("super_admin", "admin");
    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError("Choose at least one payment", 422);
    }
    return proxyApi("/payments/bulk-mark-paid", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
  } catch (error) {
    return authJson(error);
  }
}
