import { NextRequest, NextResponse } from "next/server";
import { homeForRole } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const areas = [
  { prefix: "/super-admin", role: "super_admin" },
  { prefix: "/admin", role: "admin" },
  { prefix: "/user", role: "user" },
] as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const area = areas.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));

  if (!area) {
    if (pathname === "/login" && session) {
      return NextResponse.redirect(new URL(homeForRole(session.role), request.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isSharedAdminTool =
    pathname === "/admin/users" ||
    pathname.startsWith("/admin/users/") ||
    pathname === "/admin/payments" ||
    pathname.startsWith("/admin/payments/") ||
    pathname === "/admin/reports" ||
    pathname.startsWith("/admin/reports/");
  if (isSharedAdminTool && (session.role === "admin" || session.role === "super_admin")) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (session.role !== area.role) {
    return NextResponse.redirect(new URL(homeForRole(session.role), request.url));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/super-admin/:path*", "/admin/:path*", "/user/:path*", "/login", "/api/:path*"],
};
