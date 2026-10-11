import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";
import { z } from "zod";

const schema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    currentPassword: z.string().min(8).optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine((value) => Boolean(value.name || value.newPassword), { message: "Change your name or password" });

export async function PATCH(request: Request) {
  try {
    await requireRole("super_admin", "admin", "user");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Check the form", 422);
    return proxyApi("/auth/me", { method: "PATCH", body: JSON.stringify(parsed.data) });
  } catch (error) {
    return authJson(error);
  }
}
