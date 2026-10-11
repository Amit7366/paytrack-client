import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { authJson } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireRole();
    return NextResponse.json({ success: true, message: "Profile fetched", data: user });
  } catch (error) {
    return authJson(error);
  }
}
