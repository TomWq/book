function decodeHeaderValue(value: string | null) {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readHeaderBody(request: Request) {
  const body = {
    name: decodeHeaderValue(request.headers.get("x-nw-name")),
    email: decodeHeaderValue(request.headers.get("x-nw-email")),
    password: decodeHeaderValue(request.headers.get("x-nw-password"))
  };

  return Object.fromEntries(Object.entries(body).filter(([, value]) => value));
}

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
    const headerBody = readHeaderBody(request);

    if (Object.keys(headerBody).length > 0) {
      return {
        body: headerBody,
        meta: { contentType, rawLength: raw.length, parseMode: "headers" }
      };
    }

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
