import { logoutUser } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST() {
  await logoutUser();
  return Response.json({ ok: true });
}
