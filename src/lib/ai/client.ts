import { assertAiProviderConfigured, getAiProviderConfig } from "@/lib/ai/config";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiJsonRequest = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  thinking?: boolean;
  reasoningEffort?: "low" | "medium" | "high";
};

export type AiTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptCacheHitTokens: number;
  promptCacheMissTokens: number;
  reasoningTokens: number;
};

export const AI_TOKEN_USAGE = Symbol("aiTokenUsage");

export type WithAiTokenUsage<T> = T & {
  [AI_TOKEN_USAGE]?: AiTokenUsage;
};

export type AiTextStreamRequest = AiJsonRequest & {
  onUsage?: (usage: AiTokenUsage) => void;
  allowLengthFinish?: boolean;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function normalizeTokenUsage(raw: unknown): AiTokenUsage | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const usage = raw as Record<string, unknown>;
  const promptTokens = numberValue(usage.prompt_tokens);
  const completionTokens = numberValue(usage.completion_tokens);
  const promptCacheHitTokens = numberValue(usage.prompt_cache_hit_tokens);
  const promptCacheMissTokens =
    numberValue(usage.prompt_cache_miss_tokens) ||
    Math.max(0, promptTokens - promptCacheHitTokens);
  const totalTokens = numberValue(usage.total_tokens) || promptTokens + completionTokens;
  const completionDetails =
    usage.completion_tokens_details && typeof usage.completion_tokens_details === "object"
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : {};

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    promptCacheHitTokens,
    promptCacheMissTokens,
    reasoningTokens: numberValue(completionDetails.reasoning_tokens)
  };
}

export function attachAiTokenUsage<T>(value: T, usage?: AiTokenUsage): WithAiTokenUsage<T> {
  if (!usage || !value || typeof value !== "object") {
    return value as WithAiTokenUsage<T>;
  }

  if (Object.prototype.hasOwnProperty.call(value, AI_TOKEN_USAGE)) {
    delete (value as WithAiTokenUsage<T>)[AI_TOKEN_USAGE];
  }

  Object.defineProperty(value, AI_TOKEN_USAGE, {
    value: usage,
    configurable: true,
    enumerable: false
  });

  return value as WithAiTokenUsage<T>;
}

export function getAiTokenUsage(value: unknown): AiTokenUsage | undefined {
  return value && typeof value === "object"
    ? (value as WithAiTokenUsage<unknown>)[AI_TOKEN_USAGE]
    : undefined;
}

export function combineAiTokenUsages(usages: Array<AiTokenUsage | undefined>) {
  const valid = usages.filter((usage): usage is AiTokenUsage => Boolean(usage));

  if (valid.length === 0) {
    return undefined;
  }

  return valid.reduce<AiTokenUsage>(
    (total, usage) => ({
      promptTokens: total.promptTokens + usage.promptTokens,
      completionTokens: total.completionTokens + usage.completionTokens,
      totalTokens: total.totalTokens + usage.totalTokens,
      promptCacheHitTokens: total.promptCacheHitTokens + usage.promptCacheHitTokens,
      promptCacheMissTokens: total.promptCacheMissTokens + usage.promptCacheMissTokens,
      reasoningTokens: total.reasoningTokens + usage.reasoningTokens
    }),
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      promptCacheHitTokens: 0,
      promptCacheMissTokens: 0,
      reasoningTokens: 0
    }
  );
}

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout)
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message));
}

function extractJsonCandidate(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
  const source = fenced || trimmed;
  const startObject = source.indexOf("{");
  const startArray = source.indexOf("[");

  function balancedJsonSlice(start: number, open: string, close: string) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index += 1) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === "\"") {
          inString = false;
        }

        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === open) {
        depth += 1;
      }

      if (char === close) {
        depth -= 1;

        if (depth === 0) {
          return source.slice(start, index + 1);
        }
      }
    }

    return source.slice(start);
  }

  if (startObject >= 0 && (startArray < 0 || startObject < startArray)) {
    return balancedJsonSlice(startObject, "{", "}");
  }

  if (startArray >= 0) {
    return balancedJsonSlice(startArray, "[", "]");
  }

  return source;
}

function escapeControlCharactersInJsonStrings(value: string) {
  let escaped = "";
  let inString = false;
  let isEscaped = false;

  for (const char of value) {
    const code = char.charCodeAt(0);

    if (inString && !isEscaped) {
      if (char === "\n") {
        escaped += "\\n";
        continue;
      }

      if (char === "\r") {
        escaped += "\\r";
        continue;
      }

      if (char === "\t") {
        escaped += "\\t";
        continue;
      }

      if (code >= 0 && code < 0x20) {
        escaped += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
    }

    escaped += char;

    if (char === "\"" && !isEscaped) {
      inString = !inString;
    }

    isEscaped = char === "\\" && !isEscaped;

    if (char !== "\\" && isEscaped) {
      isEscaped = false;
    }
  }

  return escaped;
}

function removeTrailingCommasOutsideJsonStrings(value: string) {
  let normalized = "";
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === "\"" && !isEscaped) {
      inString = !inString;
    }

    if (!inString && char === ",") {
      let nextIndex = index + 1;

      while (nextIndex < value.length && /\s/.test(value[nextIndex])) {
        nextIndex += 1;
      }

      if (value[nextIndex] === "}" || value[nextIndex] === "]") {
        continue;
      }
    }

    normalized += char;
    isEscaped = char === "\\" && !isEscaped;

    if (char !== "\\" && isEscaped) {
      isEscaped = false;
    }
  }

  return normalized;
}

function parseJsonCandidate<T>(candidate: string): T {
  try {
    return JSON.parse(candidate) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (/Expected double-quoted property name|Unexpected token.*}/i.test(message)) {
      return JSON.parse(removeTrailingCommasOutsideJsonStrings(candidate)) as T;
    }

    if (/control character|bad escaped character|unterminated string/i.test(message)) {
      return JSON.parse(removeTrailingCommasOutsideJsonStrings(escapeControlCharactersInJsonStrings(candidate))) as T;
    }

    throw error;
  }
}

function parseJsonContent<T>(content: string, options: { warn?: boolean } = {}): T {
  const candidate = extractJsonCandidate(content);

  try {
    return parseJsonCandidate<T>(candidate);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";

    if (detail && options.warn !== false) {
      console.warn("[ai-json] JSON 解析失败：", detail);
    }

    const friendlyMessage =
      /unterminated string|unexpected end of json input|unexpected token|end of json input/i.test(detail)
        ? "AI 返回的 JSON 不完整，可能是内容被截断了。请重试。"
        : /control character|bad escaped character/i.test(detail)
          ? "AI 返回的 JSON 格式不正确，可能包含了未转义的特殊字符。请重试。"
          : "AI 返回的内容不是有效 JSON，请重试。";

    throw new Error(friendlyMessage);
  }
}

async function requestJsonRepair<T>(
  config: Awaited<ReturnType<typeof getAiProviderConfig>>,
  originalContent: string,
  maxTokens?: number
) {
  const timeout = withTimeout(config.timeoutMs);
  const repairBody: Record<string, unknown> = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "你是 JSON 修复器。请只输出一个合法 JSON 对象，不要解释，不要 Markdown，不要代码块。保留原内容里的字段和值；如果某个字段无法修复，用空字符串或空数组。"
      },
      {
        role: "user",
        content: originalContent.slice(0, 24000)
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: Math.max(maxTokens ?? 0, 1800)
  };

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(repairBody),
      signal: timeout.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI JSON 修复请求失败：${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const choice = payload?.choices?.[0];
    const finishReason = choice?.finish_reason;
    const content = choice?.message?.content;

    if (finishReason && finishReason !== "stop") {
      throw new Error(`AI JSON 修复未正常结束：${finishReason}`);
    }

    if (!content || typeof content !== "string") {
      throw new Error("AI JSON 修复响应缺少 message.content");
    }

    return attachAiTokenUsage(parseJsonContent<T>(content, { warn: false }), normalizeTokenUsage(payload?.usage));
  } finally {
    timeout.clear();
  }
}

export async function requestAiJson<T>(request: AiJsonRequest): Promise<T> {
  const config = await getAiProviderConfig();
  assertAiProviderConfigured(config);

  const timeout = withTimeout(Math.max(config.timeoutMs, request.timeoutMs ?? 0));

  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages: request.messages,
      response_format: { type: "json_object" },
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens
    };

    if (request.thinking) {
      requestBody.thinking = { type: "enabled" };
      requestBody.reasoning_effort = request.reasoningEffort ?? "medium";
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: timeout.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI 请求失败：${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const choice = payload?.choices?.[0];
    const finishReason = choice?.finish_reason;
    const content = choice?.message?.content;

    if (finishReason && finishReason !== "stop") {
      if (finishReason === "length") {
        if (content && typeof content === "string") {
          try {
            return attachAiTokenUsage(parseJsonContent<T>(content, { warn: false }), normalizeTokenUsage(payload?.usage));
          } catch {
            const repaired = await requestJsonRepair<T>(
              config,
              content,
              Math.max(request.maxTokens ?? 0, 2400)
            );
            return attachAiTokenUsage(
              repaired,
              combineAiTokenUsages([normalizeTokenUsage(payload?.usage), getAiTokenUsage(repaired)])
            );
          }
        }

        throw new Error("AI 输出被长度限制截断，请减少输入内容或提高本次请求的输出长度上限");
      }

      throw new Error(`AI 响应未正常结束：${finishReason}`);
    }

    if (!content || typeof content !== "string") {
      throw new Error("AI 响应缺少 message.content");
    }

    try {
      return attachAiTokenUsage(parseJsonContent<T>(content, { warn: false }), normalizeTokenUsage(payload?.usage));
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (!/JSON|不是有效/i.test(message)) {
        throw error;
      }

      const repaired = await requestJsonRepair<T>(config, content, request.maxTokens);
      return attachAiTokenUsage(
        repaired,
        combineAiTokenUsages([normalizeTokenUsage(payload?.usage), getAiTokenUsage(repaired)])
      );
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("AI 请求超时或被中止，请稍后重试；如果当前任务上下文较长，请适当提高 AI 超时时间或减少上下文。");
    }

    throw error;
  } finally {
    timeout.clear();
  }
}

export async function* requestAiTextStream(request: AiTextStreamRequest): AsyncGenerator<string> {
  const config = await getAiProviderConfig();
  assertAiProviderConfigured(config);

  const timeout = withTimeout(Math.max(config.timeoutMs, request.timeoutMs ?? 0));

  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: true,
      stream_options: { include_usage: true }
    };

    if (request.thinking) {
      requestBody.thinking = { type: "enabled" };
      requestBody.reasoning_effort = request.reasoningEffort ?? "medium";
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: timeout.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI 流式请求失败：${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error("AI 流式响应缺少 body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || !trimmed.startsWith("data:")) {
          continue;
        }

        const data = trimmed.slice(5).trim();

        if (data === "[DONE]") {
          return;
        }

        const payload = JSON.parse(data) as {
          usage?: unknown;
          choices?: Array<{
            delta?: { content?: string };
            finish_reason?: string | null;
            message?: { content?: string };
          }>;
        };
        const choice = payload.choices?.[0];
        const finishReason = choice?.finish_reason;

        if (finishReason && finishReason !== "stop") {
          if (finishReason === "length") {
            if (request.allowLengthFinish) {
              return;
            }

            throw new Error("AI 输出被长度限制截断，请减少输入内容或提高本次请求的输出长度上限");
          }

          throw new Error(`AI 响应未正常结束：${finishReason}`);
        }

        const usage = normalizeTokenUsage(payload.usage);

        if (usage) {
          request.onUsage?.(usage);
          continue;
        }

        const content = choice?.delta?.content ?? choice?.message?.content ?? "";

        if (content) {
          yield content;
        }
      }
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("AI 请求超时或被中止，请稍后重试；如果当前任务上下文较长，请适当提高 AI 超时时间或减少上下文。");
    }

    throw error;
  } finally {
    timeout.clear();
  }
}
