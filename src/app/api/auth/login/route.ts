import { apiError, copySetCookies } from "@/lib/http";
import { loginSchema } from "@/lib/validations/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Validation failed", 422, parsed.error.flatten());
  }

  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
  const upstream = await fetch(`${process.env.API_URL ?? "http://localhost:4000/api"}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
    },
    body: JSON.stringify(parsed.data),
    cache: "no-store",
  });
  const payload = await upstream.json();
  const response = NextResponse.json(payload, { status: upstream.status });
  return copySetCookies(upstream, response);
}
