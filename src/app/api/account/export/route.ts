import { exportCurrentUserData } from "@/lib/projects";

export const runtime = "nodejs";

export async function GET() {
  const payload = await exportCurrentUserData();
  const filename = `ai-novel-workbench-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
