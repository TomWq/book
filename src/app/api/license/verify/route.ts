import { verifyLicenseWithCenter } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const license = await verifyLicenseWithCenter({
      licenseId: String(body.licenseId ?? ""),
      codeHash: String(body.codeHash ?? ""),
      machineHash: String(body.machineHash ?? ""),
      clientName: String(body.clientName ?? "")
    });

    return Response.json({ license });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "授权状态校验失败" },
      { status: 400 }
    );
  }
}
