import { clearLocalLicenseSession } from "@/lib/projects";

export const runtime = "nodejs";

export async function DELETE() {
  const result = await clearLocalLicenseSession();

  if (!result.ok) {
    return Response.json({ error: "当前运行模式不支持清除本地授权会话" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
