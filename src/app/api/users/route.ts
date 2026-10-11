import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET() {
  try {
    await requireRole("super_admin", "admin");
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const upstream = await fetch(`${process.env.API_URL ?? "http://localhost:4000/api"}/users`, {
      headers: { cookie: `${SESSION_COOKIE}=${token ?? ""}` },
      cache: "no-store",
    });
    const payload = await upstream.json();
    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    return authJson(error);
  }
}
