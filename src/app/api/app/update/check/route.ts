import { checkAppUpdate } from "@/lib/app-update";
import { getAppDownloadKeyForPlatform, getAppDownloadUrl } from "@/lib/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") || undefined;
  const arch = url.searchParams.get("arch") || undefined;
  const result = await checkAppUpdate({
    platform,
    arch
  });
  const downloadKey = getAppDownloadKeyForPlatform(result.platform, result.arch);

  return Response.json({
    ...result,
    downloadUrl: result.downloadUrl ? getAppDownloadUrl(downloadKey, url.origin) : ""
  });
}
