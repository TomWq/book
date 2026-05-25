import {
  compareAppVersions,
  getLocalUpdateManifest,
  type AppDownloadKey,
  type AppUpdateFile
} from "@/lib/app-update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const targetMap: Record<string, AppDownloadKey> = {
  "darwin-aarch64": "darwinArm64",
  "darwin-x86_64": "darwinX64",
  "windows-x86_64": "win32X64"
};

function publicBaseUrl(request: Request) {
  const configured = String(process.env.APP_PUBLIC_BASE_URL || process.env.LICENSE_SERVER_URL || "").trim().replace(/\/+$/, "");

  if (configured) {
    return configured;
  }

  return new URL(request.url).origin;
}

function pickUpdaterFile(file?: AppUpdateFile) {
  if (!file?.updaterUrl || !file.updaterSignature) {
    return null;
  }

  return {
    url: file.updaterUrl,
    signature: file.updaterSignature,
    label: file.label,
    sizeBytes: file.updaterSizeBytes ?? file.sizeBytes
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ target: string; arch: string; currentVersion: string }> }
) {
  const { target, arch, currentVersion } = await context.params;
  const manifest = getLocalUpdateManifest();

  if (compareAppVersions(manifest.version, currentVersion) <= 0) {
    return new Response(null, { status: 204 });
  }

  const key = targetMap[`${target}-${arch}`];
  const file = key ? manifest.files?.[key] : undefined;
  const updaterFile = pickUpdaterFile(file);

  if (!updaterFile) {
    return new Response(null, { status: 204 });
  }

  const baseUrl = publicBaseUrl(request);
  const downloadPageUrl = `${baseUrl}/download`;

  return Response.json({
    version: manifest.version,
    notes: manifest.notes,
    pub_date: manifest.releaseDate,
    url: updaterFile.url,
    signature: updaterFile.signature,
    required: manifest.required,
    announcement: manifest.announcement,
    downloadPageUrl,
    label: updaterFile.label,
    sizeBytes: updaterFile.sizeBytes
  });
}
