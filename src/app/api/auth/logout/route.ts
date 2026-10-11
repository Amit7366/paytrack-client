import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { copySetCookies } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const upstream = await fetch(`${process.env.API_URL ?? "http://localhost:4000/api"}/auth/logout`, {
    method: "POST",
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    cache: "no-store",
  });
  const payload = await upstream.json().catch(() => ({ success: true, message: "Logged out" }));
  const response = NextResponse.json(payload, { status: upstream.ok ? 200 : upstream.status });
  copySetCookies(upstream, response);
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
