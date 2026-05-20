import { generateAdminLicenseCodes, updateAdminLicenseCode } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const result = await generateAdminLicenseCodes({
      quantity: Number(body.quantity ?? 1),
      customerName: String(body.customerName ?? ""),
      customerContact: String(body.customerContact ?? ""),
      maxActivations: Number(body.maxActivations ?? 1),
      expiresAt: String(body.expiresAt ?? ""),
      notes: String(body.notes ?? "")
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "生成授权码失败" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const result = await updateAdminLicenseCode({
      licenseId: String(body.licenseId ?? ""),
      action: String(body.action ?? "") as "disable" | "reset" | "enable"
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "更新授权码失败" },
      { status: 400 }
    );
  }
}
