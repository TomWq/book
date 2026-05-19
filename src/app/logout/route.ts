import { NextResponse, type NextRequest } from "next/server";
import { logoutUser } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await logoutUser();
  return NextResponse.redirect(new URL("/login", request.url));
}
