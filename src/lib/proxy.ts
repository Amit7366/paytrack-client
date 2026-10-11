import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "./session";

const apiUrl = () => process.env.API_URL ?? "http://localhost:4000/api";

export async function proxyApi(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);

  const upstream = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = await upstream.json().catch(() => ({
    error: "The server returned an unreadable response",
    details: null,
  }));
  return NextResponse.json(payload, { status: upstream.status });
}
