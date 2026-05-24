import { restoreCurrentUserDataFromBackup } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("backup");

      if (!(file instanceof File)) {
        return Response.json({ error: "请选择要恢复的备份文件" }, { status: 400 });
      }

      payload = JSON.parse(await file.text());
    } else {
      payload = await request.json();
    }

    const result = await restoreCurrentUserDataFromBackup(payload);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "恢复数据失败" },
      { status: 400 }
    );
  }
}
