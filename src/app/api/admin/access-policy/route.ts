import { updateAdminAccessPolicy } from "@/lib/projects";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const result = await updateAdminAccessPolicy({
      requireActivation: Boolean(body.requireActivation)
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "更新访问策略失败" },
      { status: 400 }
    );
  }
}
