import { loadManualApiContent } from "@/lib/manual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const manual = await loadManualApiContent();

  return Response.json(
    {
      markdown: manual.markdown,
      source: manual.source,
      sourceUrl: manual.sourceUrl ?? "",
      updatedAt: manual.updatedAt ?? new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
