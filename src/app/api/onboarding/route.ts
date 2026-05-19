import { completeOnboarding } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST() {
  try {
    await completeOnboarding();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "更新引导状态失败" },
      { status: 400 }
    );
  }
}
