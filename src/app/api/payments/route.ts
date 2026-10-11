import { requireRole } from "@/lib/auth";
import { apiError, authJson } from "@/lib/http";
import { proxyApi } from "@/lib/proxy";
import { paymentFieldsSchema } from "@/lib/validations/payment";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin", "admin", "user");
    const url = new URL(request.url);
    return proxyApi(`/payments?${url.searchParams.toString()}`);
  } catch (error) {
    return authJson(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("super_admin", "admin");
    const body = await request.json().catch(() => null);
    const parsed = paymentFieldsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Validation failed", 422, parsed.error.flatten());
    }
    const { paymentDate, ...rest } = parsed.data;
    return proxyApi("/payments", {
      method: "POST",
      body: JSON.stringify({
        ...rest,
        paymentDate: new Date(`${paymentDate}T12:00:00`).toISOString(),
      }),
    });
  } catch (error) {
    return authJson(error);
  }
}
