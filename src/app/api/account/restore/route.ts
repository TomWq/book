import { restoreCurrentUserDataFromBackup } from "@/lib/projects";

export const runtime = "nodejs";

function restoreErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Unexpected token") || message.includes("JSON")) {
    return "备份文件不是有效的 JSON，请选择本工具导出的备份文件。";
  }

  if (/UNIQUE constraint failed/i.test(message)) {
    return "恢复失败：备份数据与现有本地数据存在重复记录。系统已保留恢复前备份，请重新导出备份后再试。";
  }

  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return "恢复失败：备份文件中的关联数据不完整，请重新导出备份后再试。";
  }

  if (/constraint failed/i.test(message)) {
    return "恢复失败：备份数据与当前本地数据库约束冲突，请重新导出备份后再试。";
  }

  if (/[\u4e00-\u9fa5]/.test(message)) {
    return message;
  }

  return "恢复数据失败，请确认文件是本工具导出的完整 JSON 备份。";
}

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
      { error: restoreErrorMessage(error) },
      { status: 400 }
    );
  }
}
