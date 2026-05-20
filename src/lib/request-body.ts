export async function readRequestBodyWithMeta(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return {
      body: Object.fromEntries(formData.entries()),
      meta: { contentType, rawLength: 0, parseMode: "form-data" }
    };
  }

  const raw = await request.text().catch(() => "");

  if (!raw.trim()) {
    return {
      body: {},
      meta: { contentType, rawLength: raw.length, parseMode: "empty" }
    };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return {
      body: Object.fromEntries(new URLSearchParams(raw).entries()),
      meta: { contentType, rawLength: raw.length, parseMode: "urlencoded" }
    };
  }

  try {
    return {
      body: JSON.parse(raw) as Record<string, unknown>,
      meta: { contentType, rawLength: raw.length, parseMode: "json" }
    };
  } catch {
    return {
      body: Object.fromEntries(new URLSearchParams(raw).entries()),
      meta: { contentType, rawLength: raw.length, parseMode: "fallback-urlencoded" }
    };
  }
}

export async function readRequestBody(request: Request) {
  return (await readRequestBodyWithMeta(request)).body;
}
