const workerUrl = process.env.JOB_WORKER_URL || "http://localhost:3000/api/jobs/worker";
const token = process.env.JOB_WORKER_TOKEN;
const limit = Number(process.env.JOB_WORKER_LIMIT || 10);
const intervalMs = Number(process.env.JOB_WORKER_INTERVAL_MS || 0);

function assertConfig() {
  if (!token) {
    throw new Error("请先配置 JOB_WORKER_TOKEN");
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("JOB_WORKER_LIMIT 必须是大于 0 的数字");
  }
}

async function runOnce() {
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-token": token
    },
    body: JSON.stringify({ limit })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Worker 请求失败：${response.status}`);
  }

  console.log(
    `[worker] ${new Date().toLocaleString("zh-CN")} processed=${payload.processed ?? 0}`
  );

  if (Array.isArray(payload.results)) {
    for (const result of payload.results) {
      console.log(
        `[worker] ${result.ok ? "ok" : "failed"} job=${result.job?.id ?? result.jobId ?? "-"} ${
          result.error ?? ""
        }`.trim()
      );
    }
  }

  return payload;
}

async function main() {
  assertConfig();

  if (!intervalMs) {
    await runOnce();
    return;
  }

  console.log(`[worker] start url=${workerUrl} interval=${intervalMs}ms limit=${limit}`);

  while (true) {
    try {
      await runOnce();
    } catch (error) {
      console.error(`[worker] ${error instanceof Error ? error.message : "执行失败"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
