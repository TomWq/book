import { readRequestBodyWithMeta } from "@/lib/request-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { body, meta } = await readRequestBodyWithMeta(request);
  const entries = Object.entries(body);

  return Response.json({
    ok: true,
    contentType: meta.contentType,
    contentLength: request.headers.get("content-length") ?? "",
    rawLength: meta.rawLength,
    parseMode: meta.parseMode,
    keys: entries.map(([key]) => key),
    values: Object.fromEntries(
      entries.map(([key, value]) => [
        key,
        key.toLowerCase().includes("password") ? "***" : String(value)
      ])
    )
  });
}
