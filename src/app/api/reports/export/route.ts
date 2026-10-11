import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET(request: Request) {
  try {
    await requireRole("super_admin", "admin");
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const url = new URL(request.url);
    const upstream = await fetch(
      `${process.env.API_URL ?? "http://localhost:4000/api"}/reports/export?${url.searchParams.toString()}`,
      {
        headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
        cache: "no-store",
      },
    );
    const body = await upstream.arrayBuffer();
    const headers = new Headers();
    headers.set("content-type", upstream.headers.get("content-type") ?? "text/csv; charset=utf-8");
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("content-disposition", disposition);
    return new NextResponse(body, { status: upstream.status, headers });
  } catch (error) {
    return authJson(error);
  }
}
