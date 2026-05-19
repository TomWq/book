# Vercel + Neon 部署说明

推荐线上组合：

1. Vercel 部署 Next.js 应用。
2. Neon 或 Supabase 提供 PostgreSQL 数据库。
3. AI 服务 Key 写入 Vercel 环境变量。

## 1. 准备数据库

在 Neon 新建一个 PostgreSQL 项目，复制连接串，格式类似：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/db?sslmode=require"
```

不要在线上使用 `file:./dev.db` 或本地 SQLite 文件。Vercel 的运行环境不适合保存本地数据库文件。

## 2. Vercel 环境变量

在 Vercel 项目设置里添加这些变量：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/db?sslmode=require"
DATABASE_POOL_SIZE="3"
STORE_RECORD_READ_MODE="auto"
AI_PROVIDER_NAME="DeepSeek"
AI_BASE_URL="https://api.deepseek.com"
AI_API_KEY="你的 AI Key"
AI_MODEL="deepseek-v4-flash"
AI_TIMEOUT_MS="60000"
JOB_WORKER_TOKEN="一串足够长的随机密钥"
ADMIN_EMAILS="你的管理员邮箱"
```

如果不想让平台默认使用服务端 AI Key，也可以留空 `AI_API_KEY`，用户登录后在「AI 设置」里填写自己的 Key。

## 3. Vercel 构建设置

默认设置即可：

```text
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

项目的 `postinstall` 会自动执行 `prisma generate`。

## 4. 部署后检查

部署完成后访问：

```text
https://你的域名/api/health
```

再注册一个账号，跑一遍：

1. 创建拆书项目。
2. 导入文本并分章。
3. 生成章节分析。
4. 保存模板。
5. 从模板生成新书大纲。

## 5. 后台任务

页面内可以触发 AI 任务。如果要批量处理待执行任务，可以请求：

```bash
curl -X POST "https://你的域名/api/jobs/worker" \
  -H "content-type: application/json" \
  -H "x-worker-token: $JOB_WORKER_TOKEN" \
  -d '{"limit":10}'
```

Vercel 不适合长期常驻 worker。如果需要定时跑任务，后续可以接入 Vercel Cron、GitHub Actions 或 Render Cron Job 调这个接口。
