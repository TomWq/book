import { getLocalUpdateManifest, toPublicUpdateManifest } from "@/lib/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(toPublicUpdateManifest(getLocalUpdateManifest(), origin));
}
