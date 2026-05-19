import { getTemplates } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET() {
  const templates = await getTemplates();
  return Response.json({ templates });
}
