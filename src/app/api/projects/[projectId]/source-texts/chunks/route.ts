import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { importSourceText } from "@/lib/projects";

export const runtime = "nodejs";

const MAX_CHUNK_CHARS = 220_000;
const UPLOAD_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;
const SAFE_SEGMENT_PATTERN = /[^a-zA-Z0-9_-]/g;

function readSourceType(value: unknown) {
  return value === "txt" ? "txt" : "paste";
}

function readInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : NaN;
}

function safeSegment(value: string) {
  return value.replace(SAFE_SEGMENT_PATTERN, "_").slice(0, 120) || "project";
}

function getUploadDir(projectId: string, uploadId: string) {
  return path.join(os.tmpdir(), "ai-novel-workbench-imports", safeSegment(projectId), uploadId);
}

function getChunkPath(uploadDir: string, chunkIndex: number) {
  return path.join(uploadDir, `chunk-${String(chunkIndex).padStart(6, "0")}.txt`);
}

function getProgressPath(uploadDir: string) {
  return path.join(uploadDir, "progress.json");
}

async function writeProgress(uploadDir: string, message: string, percent: number) {
  await mkdir(uploadDir, { recursive: true });
  await writeFile(
    getProgressPath(uploadDir),
    JSON.stringify({
      message,
      percent,
      updatedAt: Date.now()
    }),
    "utf8"
  );
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const url = new URL(request.url);
  const uploadId = String(url.searchParams.get("uploadId") ?? "");

  if (!UPLOAD_ID_PATTERN.test(uploadId)) {
    return jsonError("上传会话无效，请重新导入");
  }

  try {
    const progress = await readFile(getProgressPath(getUploadDir(projectId, uploadId)), "utf8");
    return Response.json(JSON.parse(progress));
  } catch {
    return Response.json({
      message: "正在等待服务器开始分章...",
      percent: 70
    });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const uploadId = String(body.uploadId ?? "");
    const totalChunks = readInteger(body.totalChunks);

    if (!UPLOAD_ID_PATTERN.test(uploadId)) {
      return jsonError("上传会话无效，请重新选择文件导入");
    }

    if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 10_000) {
      return jsonError("分片数量无效，请重新导入");
    }

    const uploadDir = getUploadDir(projectId, uploadId);

    if (body.complete === true) {
      await writeProgress(uploadDir, "正在读取上传分片...", 72);
      const chunks = await Promise.all(
        Array.from({ length: totalChunks }, async (_, index) => {
          try {
            return await readFile(getChunkPath(uploadDir, index), "utf8");
          } catch {
            throw new Error(`第 ${index + 1} 个文本分片缺失，请重新导入`);
          }
        })
      );
      await writeProgress(uploadDir, "正在合并长文本...", 80);
      const content = chunks.join("").trim();

      if (!content) {
        return jsonError("文本不能为空");
      }

      await writeProgress(uploadDir, "正在自动识别章节标题并保存章节...", 88);
      const result = await importSourceText({
        projectId,
        title: String(body.title ?? ""),
        sourceType: readSourceType(body.sourceType),
        content
      });

      await writeProgress(uploadDir, `分章完成，共识别 ${result.chapters.length} 章`, 100);
      await rm(uploadDir, { recursive: true, force: true }).catch(() => {});

      return Response.json(
        {
          sourceText: {
            id: result.sourceText.id,
            title: result.sourceText.title,
            charCount: result.sourceText.charCount
          },
          chapterCount: result.chapters.length
        },
        { status: 201 }
      );
    }

    const chunkIndex = readInteger(body.chunkIndex);
    const chunk = String(body.chunk ?? "");

    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
      return jsonError("文本分片序号无效，请重新导入");
    }

    if (!chunk || chunk.length > MAX_CHUNK_CHARS) {
      return jsonError("单个文本分片过大，请刷新页面后重试");
    }

    await mkdir(uploadDir, { recursive: true });
    await writeFile(getChunkPath(uploadDir, chunkIndex), chunk, "utf8");

    return Response.json({
      uploadId,
      chunkIndex,
      received: true,
      requestId: randomUUID()
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "导入失败" },
      { status: 400 }
    );
  }
}
