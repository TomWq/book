import { getProjectInspirations } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const inspirations = await getProjectInspirations(projectId);
  return Response.json({ inspirations });
}
