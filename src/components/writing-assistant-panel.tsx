"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MoLanMascot } from "@/components/molan-mascot";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

type AssistantThread = {
  id: string;
  projectId?: string;
  title: string;
  updatedAt: string;
};

const quickPrompts = [
  "帮我给书名或角色起名",
  "这个软件怎么生成第一章？",
  "帮我看这个设定会不会跑偏",
  "下一章可以怎么制造冲突？",
  "帮我加强爽点和章末钩子"
];
const streamingPlaceholder = "正在结合小说上下文思考...";
const newConversationSelection = "__new__";
const defaultAssistantName = "墨澜";

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function titleFromText(text: string) {
  const title = text
    .replace(/\s+/g, " ")
    .replace(/[《》「」“”"'`]+/g, "")
    .trim();

  return title ? (title.length > 24 ? `${title.slice(0, 24)}...` : title) : "新对话";
}

function assistantSelectionKey(projectId: string) {
  return `writing-assistant:selected-thread:${projectId || "general"}`;
}

function readAssistantSelection(projectId: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(assistantSelectionKey(projectId)) ?? "";
}

function writeAssistantSelection(projectId: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(assistantSelectionKey(projectId), value);
}

function cleanAuthorName(value?: string) {
  return String(value ?? "").trim().replace(/[，。！？,.!?]+$/g, "");
}

function cleanAssistantName(value?: string) {
  return String(value ?? "").trim().replace(/[，。！？,.!?]+$/g, "") || defaultAssistantName;
}

function welcomeMessageFor(authorName?: string, assistantName = defaultAssistantName): ChatMessage {
  const name = cleanAuthorName(authorName);

  return {
    id: "welcome",
    role: "assistant",
    content: `${name ? `${name}，您好。` : ""}我是${assistantName}，可以帮你起书名、角色名、势力名、地名、功法名，也能看小说设定、人物动机、剧情推进、爽点节奏和章节问题。软件里的创建作品、生成任务卡、导出正文、备份恢复这些功能，也可以直接问我。`
  };
}

function normalizeMessages(value: unknown, fallbackWelcome: ChatMessage): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [fallbackWelcome];
  }

  const messages = value
    .map((item): ChatMessage | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const raw = item as Record<string, unknown>;
      const role = raw.role === "assistant" ? "assistant" : raw.role === "user" ? "user" : null;
      const content = String(raw.content ?? "").trim();

      if (!role || !content) {
        return null;
      }

      return {
        id: String(raw.id ?? createId()),
        role,
        content,
        createdAt: raw.createdAt ? String(raw.createdAt) : undefined
      };
    })
    .filter((item): item is ChatMessage => Boolean(item));

  return messages.length ? messages : [fallbackWelcome];
}

function normalizeThreads(value: unknown): AssistantThread[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): AssistantThread | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const raw = item as Record<string, unknown>;
      const id = String(raw.id ?? "").trim();
      const title = String(raw.title ?? "").trim();

      if (!id || !title) {
        return null;
      }

      return {
        id,
        projectId: raw.projectId ? String(raw.projectId) : undefined,
        title,
        updatedAt: String(raw.updatedAt ?? "")
      };
    })
    .filter((item): item is AssistantThread => Boolean(item));
}

function compactAssistantMarkdown(content: string) {
  const listMarkerOnly = /^\s*(?:\d+[.)、]|[-*+])\s*$/;
  const listItem = /^\s*(?:\d+[.)、]|[-*+])\s+\S/;
  const headingLike = /^\s*(?:#{1,6}\s+\S|[*_]{2}.+[*_]{2}\s*)$/;
  const lines = content.replace(/\r\n?/g, "\n").trim().split("\n");
  const compacted: string[] = [];

  lines.forEach((line, index) => {
    const current = line.trim();
    const previous = compacted.at(-1)?.trim() ?? "";
    const next = lines[index + 1]?.trim() ?? "";

    if (current) {
      compacted.push(line);
      return;
    }

    if (!previous || !next) {
      return;
    }

    if (listMarkerOnly.test(previous) || listItem.test(next)) {
      return;
    }

    if (headingLike.test(previous) && /^[-*+]\s+\S/.test(next)) {
      return;
    }

    if (compacted.at(-1) !== "") {
      compacted.push("");
    }
  });

  return compacted.join("\n").replace(/^(\s*\d+[.)、])\s*\n\s*(?=\S)/gm, "$1 ");
}

function AssistantMessageContent({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return <>{message.content}</>;
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {compactAssistantMarkdown(message.content)}
    </ReactMarkdown>
  );
}

export function WritingAssistantPanel({
  projectId = "",
  className,
  title,
  contextLabel,
  actions,
  returnHref,
  authorName,
  assistantName,
  variant = "drawer"
}: {
  projectId?: string;
  className: string;
  title?: string;
  contextLabel?: string;
  actions?: ReactNode;
  returnHref?: string;
  authorName?: string;
  assistantName?: string;
  variant?: "drawer" | "workbench";
}) {
  const [input, setInput] = useState("");
  const authorDisplayName = useMemo(() => cleanAuthorName(authorName), [authorName]);
  const assistantDisplayName = useMemo(() => cleanAssistantName(assistantName), [assistantName]);
  const panelTitle = title ?? assistantDisplayName;
  const welcomeMessage = useMemo(() => welcomeMessageFor(authorDisplayName, assistantDisplayName), [assistantDisplayName, authorDisplayName]);
  const assistantGreeting = authorDisplayName
    ? `${authorDisplayName}，您好，我是${assistantDisplayName}`
    : `你好，我是${assistantDisplayName}`;
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [threadId, setThreadId] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === threadId) ?? null,
    [threadId, threads]
  );
  const fullPageHref = projectId ? `/assistant?projectId=${encodeURIComponent(projectId)}` : "/assistant";
  const visibleMessages = messages.filter((message) => message.id !== "welcome");
  const isEmptyConversation = visibleMessages.length === 0 && !loading && !historyLoading;

  const loadThread = useCallback(async (nextThreadId: string) => {
    if (!nextThreadId) {
      return;
    }

    setHistoryLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/assistant/chat?threadId=${encodeURIComponent(nextThreadId)}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "读取历史对话失败");
      }

      const loadedThreadId = String(payload?.thread?.id ?? nextThreadId);
      setThreadId(loadedThreadId);
      writeAssistantSelection(projectId, loadedThreadId);
      setMessages(normalizeMessages(payload?.messages, welcomeMessage));
      setRenameOpen(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "读取历史对话失败");
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId, welcomeMessage]);

  const refreshThreads = useCallback(async (options?: { autoSelectLatest?: boolean }) => {
    setHistoryLoading(true);

    try {
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const response = await fetch(`/api/assistant/chat${query}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "读取历史对话失败");
      }

      const nextThreads = normalizeThreads(payload?.threads);
      setThreads(nextThreads);

      if (options?.autoSelectLatest && nextThreads[0]) {
        const selectedThreadId = readAssistantSelection(projectId);

        if (selectedThreadId === newConversationSelection) {
          return;
        }

        if (selectedThreadId && nextThreads.some((thread) => thread.id === selectedThreadId)) {
          await loadThread(selectedThreadId);
          return;
        }

        if (!selectedThreadId) {
          await loadThread(nextThreads[0].id);
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "读取历史对话失败");
    } finally {
      setHistoryLoading(false);
    }
  }, [loadThread, projectId, welcomeMessage]);

  useEffect(() => {
    setThreadId("");
    setMessages([welcomeMessage]);
    setThreads([]);
    setError("");
    setRenameOpen(false);
  }, [projectId, welcomeMessage]);

  useEffect(() => {
    void refreshThreads({ autoSelectLatest: true });
  }, [refreshThreads]);

  useEffect(() => {
    if (isEmptyConversation) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const scrollElement = messageScrollRef.current;

      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [isEmptyConversation, loading, historyLoading, messages, threadId]);

  function startNewChat() {
    setThreadId("");
    setMessages([welcomeMessage]);
    setError("");
    setRenameOpen(false);
    writeAssistantSelection(projectId, newConversationSelection);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function sendQuestion(question: string) {
    const text = question.trim();

    if (!text || loading) {
      return;
    }

    const userMessage: ChatMessage = { id: createId(), role: "user", content: text };
    const assistantMessage: ChatMessage = { id: createId(), role: "assistant", content: streamingPlaceholder };
    let streamedContent = "";

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: text,
          projectId,
          threadId
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "AI 创作顾问暂时不可用");
      }

      if (!response.body) {
        throw new Error("AI 创作顾问暂时没有返回内容");
      }

      const responseThreadId = response.headers.get("x-assistant-thread-id") ?? "";
      const responseThreadTitle = response.headers.get("x-assistant-thread-title") ?? "";
      const nextThreadId = responseThreadId || threadId;

      setThreadId(nextThreadId);
      writeAssistantSelection(projectId, nextThreadId || newConversationSelection);

      if (nextThreadId) {
        const nextThread: AssistantThread = {
          id: nextThreadId,
          projectId: projectId || undefined,
          title: responseThreadTitle ? decodeURIComponent(responseThreadTitle) : titleFromText(text),
          updatedAt: new Date().toISOString()
        };

        setThreads((current) => [nextThread, ...current.filter((item) => item.id !== nextThread.id)].slice(0, 12));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        streamedContent += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id ? { ...message, content: streamedContent || streamingPlaceholder } : message
          )
        );
      }

      streamedContent += decoder.decode();

      if (!streamedContent.trim()) {
        throw new Error("AI 创作顾问暂时没有返回内容");
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id ? { ...message, content: streamedContent.trim() } : message
        )
      );
      void refreshThreads();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "AI 创作顾问暂时不可用");
      setMessages((current) => {
        if (streamedContent.trim()) {
          return current;
        }

        return current.filter((message) => message.id !== userMessage.id && message.id !== assistantMessage.id);
      });
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  async function renameThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeThread || !renameTitle.trim()) {
      return;
    }

    setHistoryLoading(true);
    setError("");

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: activeThread.id, title: renameTitle })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "重命名失败");
      }

      const updatedThread = payload?.thread as AssistantThread;
      setThreads((current) =>
        current.map((thread) => (thread.id === updatedThread.id ? { ...thread, ...updatedThread } : thread))
      );
      setRenameOpen(false);
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "重命名失败");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function deleteThread() {
    if (!activeThread || !window.confirm("确定删除这条 AI 对话历史吗？")) {
      return;
    }

    setHistoryLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/assistant/chat?threadId=${encodeURIComponent(activeThread.id)}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "删除失败");
      }

      setThreads((current) => current.filter((thread) => thread.id !== activeThread.id));
      startNewChat();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openRename() {
    if (!activeThread) {
      return;
    }

    setRenameTitle(activeThread.title);
    setRenameOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(input);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void sendQuestion(input);
  }

  if (variant === "workbench") {
    return (
      <section className={className} aria-label={`${assistantDisplayName}工作台`}>
        <aside className="assistant-chat-sidebar">
          <div className="assistant-chat-brand">
            <span className="assistant-chat-mascot" data-mood={loading || historyLoading ? "listening" : "idle"} aria-hidden="true">
              <MoLanMascot />
            </span>
            <div>
              <strong>{assistantDisplayName}</strong>
              <span>{projectId ? "当前作品上下文" : "通用小说创作"}</span>
            </div>
          </div>

          <button type="button" className="assistant-chat-new" onClick={startNewChat}>
            新对话
          </button>

          {returnHref ? (
            <Link href={returnHref} className="assistant-chat-return">
              返回创作页
            </Link>
          ) : null}

          <div className="assistant-chat-thread-list" aria-label="历史对话">
            {threads.length ? (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  className={thread.id === threadId ? "active" : ""}
                  onClick={() => void loadThread(thread.id)}
                  title={thread.title}
                >
                  {thread.title}
                </button>
              ))
            ) : (
              <div className="assistant-chat-empty">暂无历史对话</div>
            )}
          </div>
        </aside>

        <div className="assistant-chat-main">
          <header className="assistant-chat-topbar">
            <div>
              <strong>{activeThread?.title ?? "新对话"}</strong>
              <span>{contextLabel ?? "只回答小说创作相关问题"}</span>
            </div>
            <div className="assistant-chat-actions">
              <button type="button" className="button" disabled={!activeThread || historyLoading} onClick={openRename}>
                重命名
              </button>
              <button type="button" className="button danger" disabled={!activeThread || historyLoading} onClick={() => void deleteThread()}>
                删除
              </button>
            </div>
          </header>

          {renameOpen && activeThread ? (
            <form className="writing-assistant-rename assistant-chat-rename" onSubmit={renameThread}>
              <input value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} maxLength={36} />
              <button type="submit" className="button primary" disabled={historyLoading || !renameTitle.trim()}>
                保存
              </button>
              <button type="button" className="button" onClick={() => setRenameOpen(false)}>
                取消
              </button>
            </form>
          ) : null}

          <div ref={messageScrollRef} className={`assistant-chat-body${isEmptyConversation ? " empty" : ""}`} aria-live="polite">
            {isEmptyConversation ? (
              <div className="assistant-chat-welcome">
                <h1>{assistantGreeting}</h1>
                <p>你的小说创作顾问，也能帮你解释软件里的功能入口、创作流程、导出备份和审稿使用方式。</p>
                <div className="assistant-chat-suggestions">
                  {quickPrompts.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => void sendQuestion(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {visibleMessages.map((message) => (
                  <div key={message.id} className={`assistant-message ${message.role}`}>
                    <div className={message.role === "assistant" ? "assistant-markdown" : undefined}>
                      <AssistantMessageContent message={message} />
                    </div>
                  </div>
                ))}
                {historyLoading ? (
                  <div className="assistant-message assistant">
                    <div>正在处理历史对话...</div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {error ? <div className="writing-assistant-error assistant-chat-error">{error}</div> : null}

          <form className="assistant-chat-input" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="问小说创作相关问题，例如：帮我起几个男主名；这个角色动机合理吗？下一章怎么设计爽点？"
              rows={2}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="发送">
              发送
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className={className} id="writing-assistant-drawer" aria-label={assistantDisplayName}>
      <div className="writing-assistant-head">
        <div className="writing-assistant-title">
          <strong>{panelTitle}</strong>
          <span>{contextLabel ?? (projectId ? "已结合当前作品上下文" : "通用小说创作咨询")}</span>
        </div>
        <div className="writing-assistant-head-actions">{actions}</div>
      </div>

      <div className="writing-assistant-history">
        <button type="button" className={!threadId ? "active" : ""} onClick={startNewChat}>
          新对话
        </button>
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            className={thread.id === threadId ? "active" : ""}
            onClick={() => void loadThread(thread.id)}
            title={thread.title}
          >
            {thread.title}
          </button>
        ))}
      </div>

      <div className="writing-assistant-drawer-tip">
        <span>重命名、删除和更完整的历史管理，请进入创作对话工作台。</span>
        <Link href={fullPageHref}>进入</Link>
      </div>

      <div className="writing-assistant-thread-tools">
        <div>
          <strong>{activeThread?.title ?? "新对话"}</strong>
          <span>{activeThread ? "可继续追问，也可以重命名或删除这条历史。" : "第一次发送后会自动保存为历史对话。"}</span>
        </div>
        <div>
          <button type="button" className="button" disabled={!activeThread || historyLoading} onClick={openRename}>
            重命名
          </button>
          <button type="button" className="button danger" disabled={!activeThread || historyLoading} onClick={() => void deleteThread()}>
            删除
          </button>
        </div>
      </div>

      {renameOpen && activeThread ? (
        <form className="writing-assistant-rename" onSubmit={renameThread}>
          <input value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} maxLength={36} />
          <button type="submit" className="button primary" disabled={historyLoading || !renameTitle.trim()}>
            保存
          </button>
          <button type="button" className="button" onClick={() => setRenameOpen(false)}>
            取消
          </button>
        </form>
      ) : null}

      <div className="writing-assistant-quick">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => void sendQuestion(prompt)} disabled={loading}>
            {prompt}
          </button>
        ))}
      </div>

      <div ref={messageScrollRef} className="writing-assistant-messages" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`assistant-message ${message.role}`}>
            <div className={message.role === "assistant" ? "assistant-markdown" : undefined}>
              <AssistantMessageContent message={message} />
            </div>
          </div>
        ))}
        {historyLoading ? (
          <div className="assistant-message assistant">
            <div>正在处理历史对话...</div>
          </div>
        ) : null}
      </div>

      {error ? <div className="writing-assistant-error">{error}</div> : null}

      <form className="writing-assistant-input" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="问小说创作相关问题，例如：帮我起几个男主名；这个角色动机合理吗？下一章怎么设计爽点？"
          rows={3}
        />
        <button className="button primary" type="submit" disabled={loading || !input.trim()}>
          发送
        </button>
      </form>
    </section>
  );
}
