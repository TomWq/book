import crypto from "node:crypto";
import {
  getLocalUpdateManifest,
  getManifestDownloadUrl,
  resolveAppDownloadKey
} from "@/lib/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DownloadHit = {
  count: number;
  resetAt: number;
};

const hits = new Map<string, DownloadHit>();

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(request: Request, targetKey: string) {
  const windowMs = readNumberEnv("DOWNLOAD_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000);
  const maxHits = readNumberEnv("DOWNLOAD_RATE_LIMIT_MAX", 12);
  const now = Date.now();
  const key = `${getClientIp(request)}:${targetKey}`;
  const current = hits.get(key);

  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, resetAt: now + windowMs };
  }

  current.count += 1;

  if (current.count > maxHits) {
    return { ok: false, resetAt: current.resetAt };
  }

  return { ok: true, resetAt: current.resetAt };
}

function cleanupRateLimits() {
  const now = Date.now();

  for (const [key, value] of hits.entries()) {
    if (value.resetAt <= now) {
      hits.delete(key);
    }
  }
}

function hmacSha1Hex(key: string | Buffer, value: string) {
  return crypto.createHmac("sha1", key).update(value).digest("hex");
}

function sha1Hex(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function normalizeCosPath(pathname: string) {
  return pathname
    .split("/")
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
}

function buildCosSignedUrl(downloadUrl: string) {
  const secretId = String(process.env.COS_SECRET_ID || process.env.TENCENT_COS_SECRET_ID || "").trim();
  const secretKey = String(process.env.COS_SECRET_KEY || process.env.TENCENT_COS_SECRET_KEY || "").trim();

  if (!secretId || !secretKey) {
    return downloadUrl;
  }

  const url = new URL(downloadUrl);

  if (!url.hostname.endsWith(".myqcloud.com")) {
    return downloadUrl;
  }

  const ttlSeconds = readNumberEnv("DOWNLOAD_REDIRECT_TTL_SECONDS", 5 * 60);
  const start = Math.floor(Date.now() / 1000) - 30;
  const end = start + ttlSeconds;
  const keyTime = `${start};${end}`;
  const signTime = keyTime;
  const method = "get";
  const pathname = normalizeCosPath(url.pathname);
  const canonicalHeaders = `host=${url.hostname.toLowerCase()}\n`;
  const existingParams = [...url.searchParams.entries()]
    .filter(([key]) => key.toLowerCase() !== "sign")
    .sort(([left], [right]) => left.localeCompare(right));
  const canonicalQuery = existingParams
    .map(([key, value]) => `${encodeURIComponent(key).toLowerCase()}=${encodeURIComponent(value)}`)
    .join("&");
  const httpString = `${method}\n${pathname}\n${canonicalQuery}\n${canonicalHeaders}\n`;
  const stringToSign = `sha1\n${signTime}\n${sha1Hex(httpString)}\n`;
  const signKey = hmacSha1Hex(secretKey, keyTime);
  const signature = hmacSha1Hex(Buffer.from(signKey, "hex"), stringToSign);
  const authorization = [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${signTime}`,
    `q-key-time=${keyTime}`,
    "q-header-list=host",
    existingParams.length ? `q-url-param-list=${existingParams.map(([key]) => encodeURIComponent(key).toLowerCase()).join(";")}` : "q-url-param-list=",
    `q-signature=${signature}`
  ].join("&");

  url.searchParams.set("sign", authorization);
  return url.toString();
}

function getRedirectUrl(downloadUrl: string, request: Request) {
  const url = new URL(downloadUrl, request.url);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("下载地址协议不正确");
  }

  return buildCosSignedUrl(url.toString());
}

export async function GET(
  request: Request,
  context: { params: Promise<{ target: string }> }
) {
  cleanupRateLimits();

  const { target } = await context.params;
  const key = resolveAppDownloadKey(target);

  if (!key) {
    return Response.json({ error: "下载版本不存在" }, { status: 404 });
  }

  const rateLimit = checkRateLimit(request, key);

  if (!rateLimit.ok) {
    return Response.json(
      { error: "下载太频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)))
        }
      }
    );
  }

  const manifest = getLocalUpdateManifest();
  const downloadUrl = getManifestDownloadUrl(manifest, key);

  if (!downloadUrl) {
    return Response.json({ error: "该版本暂未发布" }, { status: 404 });
  }

  try {
    const redirectUrl = getRedirectUrl(downloadUrl, request);
    console.info(`[download] ${target} ${getClientIp(request)} -> ${new URL(downloadUrl, request.url).hostname}`);

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "下载地址无效" },
      { status: 500 }
    );
  }
}
