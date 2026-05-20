import { NextResponse, type NextRequest } from "next/server";
import { restoreSubscriptionSession } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get("next") || "/projects";
  const safeNextPath = nextPath.startsWith("/") ? nextPath : "/projects";
  const user = await restoreSubscriptionSession();

  return NextResponse.redirect(new URL(user ? safeNextPath : "/activate", request.url));
}
