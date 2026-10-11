import { jwtVerify } from "jose";

export const SESSION_COOKIE = "session";

export type SessionRole = "super_admin" | "admin" | "user";

export type Session = {
  userId: string;
  role: SessionRole;
};

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET ?? "");

export const verifySession = async (token: string): Promise<Session | null> => {
  if (!process.env.JWT_SECRET) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = typeof payload.userId === "string" ? payload.userId : payload.sub;
    const role = payload.role;
    if (!userId || (role !== "super_admin" && role !== "admin" && role !== "user")) {
      return null;
    }
    return { userId, role };
  } catch {
    return null;
  }
};
