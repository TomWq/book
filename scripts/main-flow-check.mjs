import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const timeoutMs = 60_000;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }
        reject(new Error("无法分配本地测试端口"));
      });
    });
  });
}

function collectSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

class HttpClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  rememberCookies(headers) {
    for (const rawCookie of collectSetCookie(headers)) {
      const [pair] = rawCookie.split(";");
      const [name, ...valueParts] = pair.split("=");
      const value = valueParts.join("=");

      if (name && value) {
        this.cookies.set(name.trim(), value.trim());
      }
    }
  }

  async request(method, urlPath, body, expectedStatus) {
    const headers = { "content-type": "application/json" };
    const cookie = this.cookieHeader();

    if (cookie) {
      headers.cookie = cookie;
    }

    const response = await fetch(`${this.baseUrl}${urlPath}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      redirect: "manual"
    });
    this.rememberCookies(response.headers);

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];

    assert(
      expected.includes(response.status),
      `${method} ${urlPath} 期望状态 ${expected.join("/")}，实际 ${response.status}：${text}`
    );

    return data;
  }

  get(urlPath, expectedStatus = 200) {
    return this.request("GET", urlPath, null, expectedStatus);
  }

  post(urlPath, body, expectedStatus = 200) {
    return this.request("POST", urlPath, body, expectedStatus);
  }

  delete(urlPath, expectedStatus = 200) {
    return this.request("DELETE", urlPath, null, expectedStatus);
  }
}

async function waitForServer(baseUrl, child) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode != null) {
      throw new Error(`测试服务器提前退出，退出码：${child.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "连接失败";
    }

    await delay(500);
  }

  throw new Error(`测试服务器启动超时：${lastError}`);
}

function startServer(port, storePath) {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: root,
      env: {
        ...process.env,
        APP_STORE_PATH: storePath,
        AI_BASE_URL: "",
        AI_API_KEY: "",
        AI_MODEL: ""
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  let output = "";

  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { child, getOutput: () => output.slice(-4000) };
}

const novelText = [
  "第1章 退婚当日",
  "林照被众人当场退婚，族老断言他经脉已废。可他在祖祠石碑前听见旧令苏醒，反手指出退婚书上的暗纹，把对方藏了三年的算计揭开一角。",
  "",
  "第2章 旧令入骨",
  "未婚妻的兄长想当众压住他，逼他交出最后一块祖玉。林照没有解释，只借旧令打开封存药柜，拿到第一枚洗骨丹，满堂长辈第一次安静下来。",
  "",
  "第3章 夜试锋芒",
  "夜里有人潜入柴房灭口，林照故意示弱，引对方说出幕后买主。刀光落下前，他用新得的气劲反制，留下半枚黑市令牌和一个更高层敌人的名字。"
].join("\n");

async function runMainFlow(baseUrl) {
  const suffix = Date.now();
  const userA = new HttpClient(baseUrl);
  const userB = new HttpClient(baseUrl);

  const registeredA = await userA.post(
    "/api/auth/register",
    {
      name: "验收作者A",
      email: `acceptance-a-${suffix}@example.com`,
      password: "password123"
    },
    201
  );
  assert(registeredA.user?.id, "用户 A 注册后没有返回用户");

  const projectResult = await userA.post(
    "/api/projects",
    {
      name: "验收拆书项目",
      type: "analysis",
      genre: "玄幻逆袭",
      description: "主链路验收用项目"
    },
    201
  );
  const analysisProjectId = projectResult.project?.id;
  assert(analysisProjectId, "新建拆书项目失败");

  const importResult = await userA.post(
    `/api/projects/${analysisProjectId}/source-texts`,
    {
      title: "验收样章",
      sourceType: "paste",
      content: novelText
    },
    201
  );
  assert(importResult.chapters?.length === 3, "自动分章数量不正确");

  const analysisResult = await userA.post(
    `/api/projects/${analysisProjectId}/analysis`,
    { scope: { mode: "first", limit: 2 } },
    201
  );
  assert(analysisResult.storyAnalysis?.id, "整书分析没有生成故事分析");
  assert(analysisResult.chapterAnalyses?.length === 2, "指定范围章节拆解数量不正确");

  const templateResult = await userA.post(`/api/projects/${analysisProjectId}/template`, {}, 201);
  const templateId = templateResult.template?.id;
  assert(templateId, "项目分析结果没有保存为模板");

  const outlineResult = await userA.post(
    `/api/templates/${templateId}/outlines`,
    {
      genre: "都市异能",
      protagonist: "被误判的外卖员",
      goldenFinger: "订单系统",
      worldBackground: "灵气复苏后的城市",
      pleasureDensity: "高",
      romanceStrength: "弱",
      darknessLevel: "中",
      targetReader: "男频爽文读者",
      estimatedLength: "100万字"
    },
    201
  );
  assert(outlineResult.outline?.first10Chapters?.length > 0, "模板迁移没有生成前 10 章大纲");

  const writingProject = await userA.post(
    "/api/projects",
    {
      name: "验收长篇项目",
      type: "writing",
      genre: "都市异能",
      description: "验证任务卡、正文、台账、审稿和二稿"
    },
    201
  );
  const writingProjectId = writingProject.project?.id;
  assert(writingProjectId, "新建创作项目失败");

  const state = await userA.get(`/api/projects/${writingProjectId}/writing`);
  assert(state.bible?.id && state.plotState?.id, "写作状态没有自动创建创作圣经和主线状态");

  const taskCardResult = await userA.post(
    `/api/projects/${writingProjectId}/writing`,
    {
      action: "generate_task_card",
      chapterNumber: 1,
      chapterGoal: "建立主角第一次被误判后的反击窗口",
      pleasurePoint: "被轻视后用信息差反击",
      endingHook: "章末出现更高层订单"
    },
    201
  );
  const taskCardId = taskCardResult.taskCard?.id;
  assert(taskCardId, "没有生成章节任务卡");

  const draftResult = await userA.post(
    `/api/projects/${writingProjectId}/writing`,
    { action: "generate_draft", taskCardId },
    201
  );
  const draftId = draftResult.draft?.id;
  assert(draftId, "没有生成正文草稿");

  const ledgerResult = await userA.post(
    `/api/projects/${writingProjectId}/writing`,
    { action: "create_ledger", draftId },
    201
  );
  assert(ledgerResult.ledger?.id, "没有生成章节台账");

  const reviewResult = await userA.post(
    `/api/projects/${writingProjectId}/writing`,
    { action: "review_draft", draftId },
    201
  );
  assert(reviewResult.review?.id, "没有生成审稿报告");

  const editResult = await userA.post(
    `/api/projects/${writingProjectId}/writing`,
    {
      action: "edit_text",
      mode: "网文作者版",
      text: "本章通过主角反击体现了人物成长，整体节奏较为平稳，具有重要意义。"
    },
    201
  );
  assert(editResult.editReport?.revisedText, "没有生成二稿编辑结果");

  const finalState = await userA.get(`/api/projects/${writingProjectId}/writing`);
  assert(finalState.taskCards?.length >= 1, "写作状态没有记录任务卡");
  assert(finalState.drafts?.length >= 1, "写作状态没有记录正文草稿");
  assert(finalState.ledgers?.length >= 1, "写作状态没有记录章节台账");
  assert(finalState.reviews?.length >= 1, "写作状态没有记录审稿报告");
  assert(finalState.editReports?.length >= 1, "写作状态没有记录二稿结果");

  const registeredB = await userB.post(
    "/api/auth/register",
    {
      name: "验收作者B",
      email: `acceptance-b-${suffix}@example.com`,
      password: "password123"
    },
    201
  );
  assert(registeredB.user?.id, "用户 B 注册后没有返回用户");

  const projectsB = await userB.get("/api/projects");
  assert(projectsB.projects?.length === 0, "用户 B 不应该看到用户 A 的项目");

  const forbiddenWriting = await userB.get(`/api/projects/${writingProjectId}/writing`, 404);
  assert(forbiddenWriting.error, "用户 B 访问用户 A 写作状态时应该被拒绝");

  const deleteResult = await userA.delete(`/api/projects/${writingProjectId}`);
  assert(deleteResult.ok, "用户 A 删除自己的项目失败");

  const deletedWriting = await userA.get(`/api/projects/${writingProjectId}/writing`, 404);
  assert(deletedWriting.error, "项目删除后不应该再能读取写作状态");
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), "novel-workbench-"));
const storePath = path.join(tempDir, "app-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = startServer(port, storePath);

try {
  await waitForServer(baseUrl, server.child);
  await runMainFlow(baseUrl);
  console.log("主链路验收通过：注册登录、导入分章、章节拆解、整书分析、模板、大纲、长篇创作、台账、审稿、二稿和用户隔离均可用。");
} catch (error) {
  console.error(server.getOutput());
  throw error;
} finally {
  server.child.kill("SIGTERM");
  await delay(300);
  await rm(tempDir, { recursive: true, force: true });
}
