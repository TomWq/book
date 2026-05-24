import { redirect } from "next/navigation";
import { WritingAssistantPanel } from "@/components/writing-assistant-panel";
import { getCurrentUser } from "@/lib/projects";

function safeReturnPath(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value.startsWith("/login") || value.startsWith("/register") || value.startsWith("/activate")) {
    return fallback;
  }

  return value;
}

export default async function AssistantPage({
  searchParams
}: {
  searchParams?: Promise<{ projectId?: string; returnTo?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const returnHref = safeReturnPath(params.returnTo, projectId ? `/projects/${projectId}` : "/");

  return (
    <div className="assistant-page">
      <WritingAssistantPanel
        projectId={projectId}
        returnHref={returnHref}
        className="assistant-chat-workbench"
        title="AI 创作顾问"
        contextLabel={projectId ? "已绑定当前作品上下文" : "通用小说创作咨询"}
        authorName={user.penName || user.name}
        variant="workbench"
      />
    </div>
  );
}
