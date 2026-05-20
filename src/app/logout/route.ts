import { NextResponse, type NextRequest } from "next/server";
import { isDesktopRuntime } from "@/lib/app-runtime";
import { getBillingMode } from "@/lib/billing-mode";
import { logoutUser } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await logoutUser();
  return NextResponse.redirect(
    new URL(isDesktopRuntime() && getBillingMode() === "subscription" ? "/activate" : "/login", request.url)
  );
}
