"use client";

import { type CSSProperties, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const DIRECT_IMPORT_LIMIT_BYTES = 700 * 1024;
const CHUNK_CHAR_LIMIT = 180_000;
const UPLOAD_PROGRESS_WEIGHT = 70;

type ImportPayload = {
  title: string;
  sourceType: "paste" | "txt";
  content: string;
};

type ServerImportProgress = {
  message?: string;
  percent?: number;
};

async function readError(response: Response) {
  const body = await response.clone().json().catch(async () => {
    const text = await response.clone().text().catch(() => "");
    return text ? { error: text } : null;
  });
  return body?.error ? String(body.error) : "导入失败，请检查文本大小或稍后重试";
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatElapsed(seconds: number) {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes} 分 ${rest} 秒`;
}

function ImportLoadingOverlay({
  text,
  percent,
  elapsedSeconds
}: {
  text: string;
  percent: number | null;
  elapsedSeconds: number;
}) {
  const progressStyle =
    percent === null
      ? undefined
      : ({
          "--import-progress": `${Math.max(0, Math.min(100, percent))}%`
        } as CSSProperties);

  return (
    <div className="action-loading-overlay" aria-live="polite" role="status">
      <div className="route-loading-board">
        <div className="route-loading-head">
          <span className="loading-bookmark" aria-hidden="true">
            <span />
          </span>
          <div>
            <strong>正在导入并分章</strong>
            <span>{text}</span>
          </div>
          {percent !== null ? <span className="import-loading-percent">{Math.round(percent)}%</span> : null}
        </div>
        <span
          className="route-loading-progress import-loading-progress"
          data-progress={percent === null ? undefined : "true"}
          style={progressStyle}
          aria-hidden="true"
        />
        <div className="import-loading-meta">已用时 {formatElapsed(elapsedSeconds)}</div>
      </div>
    </div>
  );
}

export function ImportSourceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [startedAt]);

  function updateProgress(message: string, percent: number | null = null) {
    setProgress(message);
    setProgressPercent(percent);
  }

  function resetPendingState() {
    setProgress("");
    setProgressPercent(null);
    setIsSubmitting(false);
    setStartedAt(null);
    setElapsedSeconds(0);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isPending) {
      return;
    }
    setError("");
    setProgress("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const sourceType: ImportPayload["sourceType"] = formData.get("sourceType") === "txt" ? "txt" : "paste";
    const file = formData.get("file");
    const pastedContent = String(formData.get("content") ?? "").trim();
    let content = pastedContent;

    if (sourceType === "txt" && file instanceof File && file.size > 0) {
      content = (await file.text()).trim();
    }

    if (!content) {
      setError(sourceType === "txt" ? "请先上传 TXT 文件或粘贴文本" : "请先粘贴小说文本");
      return;
    }

    setIsSubmitting(true);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
    const payload = {
      title: String(formData.get("title") ?? ""),
      sourceType,
      content
    };
    const payloadSize = new Blob([JSON.stringify(payload)]).size;

    try {
      if (payloadSize > DIRECT_IMPORT_LIMIT_BYTES) {
        await importInChunks(payload);
        return;
      }

      updateProgress("正在把文本发送到服务器...", 20);
      const response = await fetch(`/api/projects/${projectId}/source-texts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        setError(await readError(response));
        resetPendingState();
        return;
      }

      updateProgress("分章完成，正在打开章节列表...", 100);
      startTransition(() => {
        router.push(`/projects/${projectId}/chapters`);
        router.refresh();
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "导入失败，请稍后重试");
      resetPendingState();
    }
  }

  async function importInChunks(payload: ImportPayload) {
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(payload.content.length / CHUNK_CHAR_LIMIT);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      updateProgress(
        `正在上传长文本 ${chunkIndex + 1}/${totalChunks}`,
        Math.max(1, Math.round(((chunkIndex + 1) / totalChunks) * UPLOAD_PROGRESS_WEIGHT))
      );
      const chunk = payload.content.slice(
        chunkIndex * CHUNK_CHAR_LIMIT,
        (chunkIndex + 1) * CHUNK_CHAR_LIMIT
      );
      const response = await fetch(`/api/projects/${projectId}/source-texts/chunks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          chunkIndex,
          totalChunks,
          chunk
        })
      });

      if (!response.ok) {
        setError(await readError(response));
        resetPendingState();
        return;
      }
    }

    updateProgress("正在合并文本并自动分章...", UPLOAD_PROGRESS_WEIGHT);
    let shouldPoll = true;
    const progressQuery = new URLSearchParams({ uploadId });
    const pollProgress = async () => {
      while (shouldPoll) {
        const response = await fetch(`/api/projects/${projectId}/source-texts/chunks?${progressQuery.toString()}`, {
          method: "GET",
          cache: "no-store"
        }).catch(() => null);

        if (response?.ok) {
          const serverProgress = (await response.json().catch(() => null)) as ServerImportProgress | null;
          if (serverProgress?.message) {
            updateProgress(serverProgress.message, serverProgress.percent ?? null);
          }
        }

        await sleep(800);
      }
    };

    const polling = pollProgress();
    const response = await fetch(`/api/projects/${projectId}/source-texts/chunks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        title: payload.title,
        sourceType: payload.sourceType,
        complete: true
      })
    });
    shouldPoll = false;
    await polling.catch(() => {});

    if (!response.ok) {
      setError(await readError(response));
      resetPendingState();
      return;
    }

    updateProgress("分章完成，正在打开章节列表...", 100);
    startTransition(() => {
      router.push(`/projects/${projectId}/chapters`);
      router.refresh();
    });
  }

  return (
    <>
      {isSubmitting && progress ? (
        <ImportLoadingOverlay text={progress} percent={progressPercent} elapsedSeconds={elapsedSeconds} />
      ) : null}
      <form className="forms" onSubmit={handleSubmit} aria-busy={isSubmitting || isPending}>
        <div className="split-panels">
          <div className="field">
            <div className="field-label">导入来源</div>
            <select name="sourceType" defaultValue="txt">
              <option value="txt">TXT 文件</option>
              <option value="paste">直接粘贴</option>
            </select>
          </div>
          <div className="field">
            <div className="field-label">文本标题</div>
            <input name="title" placeholder="例如：前 30 章分析文本" />
          </div>
        </div>
        <div className="field">
          <div className="field-label">TXT 文件</div>
          <input name="file" type="file" accept=".txt,text/plain" />
        </div>
        <div className="field">
          <div className="field-label">长文本</div>
          <textarea
            name="content"
            placeholder="把小说文本贴到这里，系统会先保存原文，再自动分章并写入章节列表。"
          />
        </div>
        <div className="hero-actions">
          <button className="button" type="submit" disabled={isSubmitting || isPending}>
            {progress || (isSubmitting || isPending ? "分章中..." : "开始分章")}
          </button>
        </div>
        {progress ? <div className="pill form-status">{progress}</div> : null}
        {error ? <div className="pill danger form-error">{error}</div> : null}
      </form>
    </>
  );
}
