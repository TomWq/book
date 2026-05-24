"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WritingAssistantPanel } from "@/components/writing-assistant-panel";

function getProjectId(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1] ?? "";

  return projectId && projectId !== "new" ? projectId : "";
}

export function FloatingWritingAssistant({ authorName }: { authorName?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = useMemo(() => getProjectId(pathname), [pathname]);
  const [open, setOpen] = useState(false);
  const currentQuery = searchParams.toString();
  const currentPath = currentQuery ? `${pathname}?${currentQuery}` : pathname;
  const workbenchParams = new URLSearchParams();

  if (pathname === "/assistant") {
    return null;
  }

  if (projectId) {
    workbenchParams.set("projectId", projectId);
  }

  workbenchParams.set("returnTo", currentPath);

  const workbenchQuery = workbenchParams.toString();
  const workbenchHref = workbenchQuery ? `/assistant?${workbenchQuery}` : "/assistant";

  function enterWorkbench() {
    setOpen(false);
    router.push(workbenchHref);
  }

  return (
    <>
      <button
        className="floating-ai-button"
        type="button"
        aria-expanded={open}
        aria-controls="writing-assistant-drawer"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="floating-ai-orb" aria-hidden="true">
          <span className="floating-ai-book" />
          <span className="floating-ai-face" />
          <span className="floating-ai-label">AI</span>
        </span>
      </button>

      {open ? (
        <WritingAssistantPanel
          projectId={projectId}
          className="writing-assistant-drawer"
          authorName={authorName}
          actions={
            <>
              <button
                type="button"
                className="writing-assistant-workbench-button"
                onClick={enterWorkbench}
              >
                进入工作台
              </button>
              <button type="button" aria-label="关闭 AI 创作顾问" onClick={() => setOpen(false)}>
                ×
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
