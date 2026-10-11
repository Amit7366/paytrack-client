import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { homeForRole } from "./roles";
import { SESSION_COOKIE, SessionRole, verifySession } from "./session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: SessionRole;
  isActive: boolean;
};

export class AuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const apiUrl = () => process.env.API_URL ?? "http://localhost:4000/api";

const publicUser = (value: unknown): CurrentUser | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const role = record.role;
  if (typeof record.id !== "string" || typeof record.name !== "string" || typeof record.email !== "string") {
    return null;
  }
  if (role !== "super_admin" && role !== "admin" && role !== "user") return null;
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role,
    isActive: record.isActive !== false,
  };
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const response = await fetch(`${apiUrl()}/auth/me`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { data?: unknown };
  return publicUser(payload.data);
}

export async function requireRole(...roles: SessionRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isApi = pathname.startsWith("/api");

  if (!user) {
    if (isApi) throw new AuthError(401, "Authentication required");
    redirect("/login");
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    if (isApi) throw new AuthError(403, "You do not have permission for this action");
    redirect(homeForRole(user.role));
  }

  return user;
}
