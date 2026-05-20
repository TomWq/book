import { NextResponse, type NextRequest } from "next/server";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { logoutUser } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await logoutUser();
  return NextResponse.redirect(
    new URL(isDesktopRuntime() ? "/activate" : "/login", request.url)
  );
}
