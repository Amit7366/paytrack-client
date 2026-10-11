import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export const apiError = (error: string, status = 422, details: unknown = null) =>
  NextResponse.json({ error, details }, { status });

export const authJson = (error: unknown) => {
  if (error instanceof AuthError) {
    return apiError(error.message, error.status);
  }
  throw error;
};

export const copySetCookies = (upstream: Response, response: NextResponse) => {
  for (const cookie of upstream.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
};
