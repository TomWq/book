# 技术架构设计

**项目**：AI 网文写作助手  
**版本**：v0.1  
**日期**：2026-05-15  
**范围**：Web 平台第一版技术方案

## 1. 架构目标

本项目不是纯前端工具，必须具备后端、数据库和异步任务能力。

第一版架构要解决五个核心问题：

1. 长文本导入、自动分章和批量章节分析。
2. AI 调用统一走后端，避免模型 Key 暴露。
3. 拆书结果、模板、人物、伏笔、章节台账等长期状态持久化。
4. 长篇创作时只给 AI 提供“短、准、结构化”的上下文，避免越写越跑偏。
5. 支持多用户登录和数据隔离，避免项目、模板、AI Key 和任务互相串号。

## 2. 推荐技术栈

### 2.1 Web 应用

推荐使用：

1. Next.js
2. React
3. TypeScript
4. Tailwind CSS

原因：

1. 前后端可以先放在同一个项目里，降低第一版复杂度。
2. Next.js API Routes / Route Handlers 足够支撑 MVP。
3. 后续可以平滑拆出独立后端服务。

### 2.2 后端

第一版可以使用 Next.js Route Handlers 作为后端 API。

后续如果任务量变大，再拆成：

1. Web 前端服务。
2. API 服务。
3. Worker 服务。

### 2.3 数据库

推荐：

1. PostgreSQL
2. Prisma 或 Drizzle

优先建议 PostgreSQL，因为本产品会大量存储结构化 JSON、长文本、状态快照和任务记录。

当前实现要求：

1. 生产/正式测试环境设置 `DATABASE_URL=postgresql://...` 后，应用状态优先写入 PostgreSQL 的 `AppState` 表。
2. 同时写入 `StoreRecord` 域记录镜像表，把用户、项目、章节、模板、任务、写作状态等记录拆成可按用户和项目索引的 JSONB 记录，便于下一步从 AppState 桥接迁移到正式 Repository。
3. 当 `AppState` 不存在时，服务端可以从 `StoreRecord` 反向恢复应用状态；设置 `STORE_RECORD_READ_MODE=prefer` 时可优先从域记录镜像恢复，用于迁移演练。
4. 本地开发可以继续使用 JSON 文件；如设置 `DATABASE_URL=file:...`，SQLite 只作为本地兼容桥和调试镜像。
5. 后续拆分独立 API/Worker 时，以 PostgreSQL 为唯一持久化目标，不再把 SQLite bridge 作为最终数据库方案。

### 2.4 异步任务

MVP 阶段：

1. 使用数据库表 `ai_jobs` 做任务队列。
2. 通过后台 worker 轮询或 server action 触发处理。

当前实现要求：

1. 拆书分析、大纲生成、章节任务卡、章节正文、章节审稿、二稿编辑统一通过 `ai_jobs` 任务类型表达。
2. API 可使用 `defer: true` 只创建待执行任务，再由 `/api/jobs/run` 或后续独立 worker 执行。
3. 立即生成模式保留给 MVP 交互，但底层仍写入对应 job，避免前端绕过任务记录。
4. `/api/jobs/worker` 支持用 `JOB_WORKER_TOKEN` 调用后台批处理，执行时会切换到任务所属用户上下文，避免跨用户执行和串号。
5. `npm run worker` 可作为部署前的轻量 Worker 进程；设置 `JOB_WORKER_INTERVAL_MS` 后会循环扫描待处理任务。

后续升级：

1. Redis
2. BullMQ
3. 独立 Worker 进程

### 2.5 AI 调用

AI 调用必须由后端统一封装。

前端只提交任务：

```text
前端 → 后端创建 AI Job → Worker 调用模型 → 保存结果 → 前端轮询/订阅进度
```

禁止：

1. 前端直接调用模型 API。
2. 前端保存模型 Key。
3. 将整个长篇正文一次性塞给模型。

### 2.6 认证与权限

第一版必须具备基础账号体系，不再按单机模式设计。

推荐做法：

1. 邮箱 + 密码注册和登录。
2. 服务端保存用户表和会话表。
3. 客户端使用 HTTP-only Cookie 维持登录态。
4. 所有项目、模板、AI 设置和 AI 任务都必须绑定用户。
5. 后端路由和 worker 执行都要检查归属，防止跨用户读取或执行。
6. 账号层需要有基础套餐/额度统计、导出和删除能力，方便正式推广前的用户治理。

当前实现约定：

1. 会话 Cookie 名为 `nw_session`。
2. 未登录访问业务页面跳转到 `/login`。
3. 未登录访问业务 API 返回 401。
4. `/logout` 清理服务端 session 并回到登录页。
5. 老本地数据如果没有 owner，首个注册/登录用户会认领该工作区，便于从单机开发模式迁移。

## 3. 总体架构

```text
Browser
  |
  | HTTP / SSE
  v
Next.js Web App
  |
  | Route Handlers
  v
API Layer
  |
  | Prisma / Drizzle
  v
PostgreSQL
  ^
  |
Worker / Job Runner
  |
  | AI Provider SDK
  v
AI Model
```

## 4. 核心模块

### 4.1 Project 模块

负责：

1. 创建拆书项目。
2. 创建创作项目。
3. 管理项目状态。
4. 展示项目进度。

项目类型：

1. `analysis`：拆书项目。
2. `writing`：创作项目。

### 4.2 Import 模块

负责：

1. TXT 上传。
2. 文本粘贴。
3. 保存原始文本。
4. 自动分章。
5. 手动调整章节。

### 4.3 Analysis 模块

负责：

1. 逐章拆解。
2. 爽点识别。
3. 整书节奏分析。
4. 爆款公式提取。

### 4.4 Template 模块

负责：

1. 保存故事公式。
2. 管理模板库。
3. 按题材和标签分类。
4. 从模板生成新书大纲。

### 4.5 Writing 模块

负责：

1. 创作圣经。
2. 人物档案。
3. 伏笔表。
4. 主线状态。
5. 章节任务卡。
6. 章节正文。
7. 章节台账。
8. 一致性审稿。

### 4.6 Editor 模块

负责：

1. AI 味检测。
2. 二稿编辑。
3. 拆书文章改写。
4. 小说正文增强。

### 4.7 Job 模块

负责：

1. 创建 AI 任务。
2. 记录任务状态。
3. 失败重试。
4. 保存 AI 输入摘要和输出结果。
5. 提供任务进度给前端。

### 4.8 Account 模块

负责：

1. 展示账号套餐和额度。
2. 展示当前月 AI 任务、项目、模板和导入字符用量。
3. 展示积分余额、充值包和消费流水。
4. 导出账号数据。
5. 提供新手引导完成状态。

### 4.9 Admin 模块

负责：

1. 查看注册用户列表。
2. 查看用户积分余额、累计消耗和累计充值/赠送。
3. 查看平台总用户数、总积分余额和 AI 任务量。
4. 手动给用户充值或赠送积分。
5. 管理员入口只允许 `role=admin` 或 `ADMIN_EMAILS` 配置用户访问，不允许普通注册用户自动获得后台权限。

## 5. 数据库设计初稿

字段类型后续以 ORM schema 为准。这里先定义数据边界。

### 5.1 users

```text
id
email
name
password_salt
password_hash
role
created_at
updated_at
```

### 5.1.1 sessions

```text
id
user_id
token
created_at
expires_at
last_seen_at
```

### 5.2 projects

```text
id
owner_user_id
name
type                  analysis / writing
description
status                draft / processing / ready / archived
created_at
updated_at
```

### 5.3 source_texts

```text
id
project_id
title
content
source_type           paste / txt
char_count
created_at
updated_at
```

### 5.4 chapters

```text
id
project_id
source_text_id
chapter_number
title
content
char_count
order_index
created_at
updated_at
```

### 5.5 chapter_analyses

```text
id
project_id
chapter_id
summary
main_event
conflict
pressure_point
payoff
cliffhanger
reader_hook
new_information       json
new_characters        json
state_changes         json
pleasure_points       json
raw_result            json
model
created_at
updated_at
```

### 5.6 story_formulas

```text
id
project_id
genre
protagonist_model
opening_hook
golden_finger
main_loop
chapter_pacing
villain_function
supporting_roles
map_progression
usable_patterns       json
avoid_copying         json
raw_result            json
created_at
updated_at
```

### 5.7 templates

```text
id
owner_user_id
source_formula_id
name
genre
description
protagonist_model
opening_hook
golden_finger
main_loop
chapter_pacing
usable_patterns       json
avoid_copying         json
tags                  json
created_at
updated_at
```

### 5.8 outlines

```text
id
project_id
template_id
title_options         json
logline
intro
core_selling_points   json
world_setting         json
protagonist           json
characters           json
first_10_chapters     json
first_100_pacing      json
foreshadowing_plan    json
pleasure_distribution json
created_at
updated_at
```

### 5.9 writing_bibles

```text
id
project_id
work_type
target_reader
core_pleasure
protagonist_desire
world_rules           json
golden_finger_rules   json
power_system          json
narrative_taboo       json
style_guide
created_at
updated_at
```

### 5.10 character_profiles

```text
id
project_id
name
role
identity
current_goal
long_term_goal
secret
relationship_to_protagonist
attitude
ability_boundary
speech_style
known_information     json
unknown_information   json
last_appearance_chapter
current_state
created_at
updated_at
```

### 5.11 foreshadowings

```text
id
project_id
name
setup_chapters        json
related_characters    json
related_locations     json
status                open / partial / resolved
expected_payoff_chapter
payoff_method
hidden_information
created_at
updated_at
```

### 5.12 plot_states

```text
id
project_id
current_volume
current_map
main_goal
short_term_goal
current_enemy
open_threads          json
resolved_threads      json
next_stage_goal
created_at
updated_at
```

### 5.13 chapter_ledgers

```text
id
project_id
chapter_id
chapter_number
title
events                json
new_characters        json
new_clues             json
payoff
cliffhanger
state_changes         json
created_at
updated_at
```

### 5.14 chapter_drafts

```text
id
project_id
chapter_number
title
task_card             json
content
status                draft / reviewed / accepted
created_at
updated_at
```

### 5.15 review_reports

```text
id
project_id
chapter_draft_id
issues                json
summary
needs_state_update
created_at
updated_at
```

### 5.16 ai_jobs

```text
id
user_id
project_id
type                  split_chapters / analyze_chapter / analyze_story / extract_formula / generate_outline / generate_task_card / generate_chapter / review_chapter / edit_second_draft
status                pending / running / succeeded / failed / canceled
input                 json
output                json
error
attempts
model
created_at
updated_at
started_at
finished_at
```

### 5.17 account_usage

账号额度不单独拆表，第一版直接通过 `AppState` 统计实现。后续如果要做计费和限流，再拆分为独立的 usage 记录表和账单表。

## 6. API 设计初稿

API 路径以 REST 为主，后续可以根据框架调整。

除 `/login`、`/logout` 和 `/api/health` 外，业务接口默认需要登录态。项目、模板、任务和设置接口必须以当前用户为权限边界。

### 6.1 Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId
```

### 6.2 Import

```text
POST /api/projects/:projectId/source-texts
POST /api/source-texts/:sourceTextId/split
GET  /api/source-texts/:sourceTextId/chapters
PUT  /api/source-texts/:sourceTextId/chapters
```

### 6.3 Analysis

```text
POST /api/projects/:projectId/analysis/start
GET  /api/projects/:projectId/analysis/progress
GET  /api/chapters/:chapterId/analysis
POST /api/projects/:projectId/story-analysis
POST /api/projects/:projectId/formula
```

### 6.4 Templates

```text
GET    /api/templates
POST   /api/templates
GET    /api/templates/:templateId
PATCH  /api/templates/:templateId
DELETE /api/templates/:templateId
POST   /api/templates/:templateId/generate-outline
```

### 6.5 Writing

```text
GET   /api/projects/:projectId/writing-state
PATCH /api/projects/:projectId/writing-bible
GET   /api/projects/:projectId/characters
POST  /api/projects/:projectId/characters
PATCH /api/characters/:characterId
GET   /api/projects/:projectId/foreshadowings
POST  /api/projects/:projectId/foreshadowings
PATCH /api/foreshadowings/:foreshadowingId
POST  /api/projects/:projectId/chapter-task-card
POST  /api/projects/:projectId/chapter-drafts
POST  /api/chapter-drafts/:chapterDraftId/review
POST  /api/chapter-drafts/:chapterDraftId/accept
```

### 6.6 Jobs

```text
GET  /api/jobs/:jobId
POST /api/jobs/:jobId/retry
GET  /api/projects/:projectId/jobs
```

### 6.7 Auth

```text
GET   /login
POST  /login
GET   /logout
POST  /logout
```

## 7. AI 任务流

### 7.1 章节拆解任务

输入：

1. 章节标题。
2. 章节正文。
3. 作品基本信息。

输出：

```json
{
  "summary": "",
  "main_event": "",
  "conflict": "",
  "pressure_point": "",
  "payoff": "",
  "cliffhanger": "",
  "reader_hook": "",
  "new_information": [],
  "new_characters": [],
  "state_changes": [],
  "pleasure_points": [
    {
      "type": "",
      "setup": "",
      "release": "",
      "why_it_works": "",
      "drives_main_plot": true
    }
  ]
}
```

### 7.2 整书分析任务

输入：

1. 前 N 章章节分析结果。
2. 章节标题列表。
3. 项目题材信息。

输出：

1. 开局钩子。
2. 主循环。
3. 爽点频率。
4. 金手指出现时机。
5. 地图推进。
6. 反派升级。
7. 断章习惯。

### 7.3 公式提取任务

输入：

1. 章节分析结果。
2. 整书节奏分析。

输出：

1. 题材类型。
2. 主角模型。
3. 开局模型。
4. 金手指机制。
5. 核心冲突循环。
6. 可迁移结构。
7. 不可照搬内容。

### 7.4 大纲生成任务

输入：

1. 模板。
2. 新题材变量。

输出：

1. 书名方向。
2. 简介。
3. 核心卖点。
4. 世界观简表。
5. 前 10 章大纲。
6. 前 100 章节奏表。
7. 伏笔安排。

### 7.5 章节任务卡任务

输入：

1. 创作圣经。
2. 当前卷纲。
3. 最近 3-5 章台账。
4. 本章相关人物卡。
5. 本章相关伏笔。
6. 当前主线状态。
7. 上一章结尾钩子。

输出：

```json
{
  "chapter_goal": "",
  "previous_chapter_continuity": "",
  "main_plot_progress": "",
  "required_characters": [],
  "pleasure_point": "",
  "foreshadowing_to_setup_or_payoff": [],
  "rules_not_to_break": [],
  "ending_hook": ""
}
```

### 7.6 章节生成任务

输入：

1. 本章任务卡。
2. 必要项目状态。
3. 风格要求。

输出：

1. 章节标题。
2. 章节正文。

交互方式：

1. 正文生成可以使用流式接口，让前端实时显示正文。
2. 流式结束后，后端仍必须保存完整草稿、任务记录和使用来源。
3. 如果模型流式失败，可以切回本地草稿兜底，并把任务标记为本地兜底结果。

注意：

1. 不允许随意新增重大设定。
2. 不允许让人物知道未知信息。
3. 不允许改变金手指规则。

### 7.7 审稿任务

输入：

1. 章节正文。
2. 本章任务卡。
3. 创作圣经。
4. 人物卡。
5. 伏笔表。
6. 最近章节台账。

输出：

```json
{
  "summary": "",
  "needs_state_update": true,
  "issues": [
    {
      "type": "character_inconsistency",
      "severity": "medium",
      "location": "第12段",
      "problem": "",
      "suggestion": ""
    }
  ]
}
```

## 8. 长篇不跑偏策略

### 8.1 不把全文塞给 AI

每次生成时只提供相关上下文：

1. 稳定规则。
2. 最近事件。
3. 相关人物。
4. 相关伏笔。
5. 当前主线。
6. 本章任务。

### 8.2 状态必须结构化

正文不是唯一记忆。真正的记忆来自：

1. `writing_bibles`
2. `character_profiles`
3. `foreshadowings`
4. `plot_states`
5. `chapter_ledgers`

### 8.3 每章都有闭环

```text
任务卡 → 正文 → 台账 → 状态更新 → 审稿 → 下一章
```

如果跳过台账和审稿，长篇创作功能视为不完整。

## 9. 前端页面结构

推荐路由：

```text
/
/projects
/projects/new
/projects/:projectId
/projects/:projectId/import
/projects/:projectId/chapters
/projects/:projectId/analysis
/templates
/templates/:templateId
/templates/:templateId/generate-outline
/projects/:projectId/writing
/projects/:projectId/state
/projects/:projectId/editor
```

## 10. 前端交互原则

### 10.1 首页

直接进入工作台，不做营销型大首页。

首页应展示：

1. 最近项目。
2. 新建拆书项目。
3. 新建创作项目。
4. 模板库入口。

### 10.2 拆书项目页

核心信息：

1. 文本导入状态。
2. 分章结果。
3. 分析进度。
4. 章节拆解列表。
5. 整书公式。
6. 保存模板按钮。

### 10.3 创作工作台

核心布局建议：

1. 左侧：章节列表、项目状态入口。
2. 中间：任务卡和正文编辑器。
3. 右侧：人物、伏笔、主线、审稿提示。

重点是效率，不做装饰性页面。

## 11. 错误处理

### 11.1 AI 任务失败

需要显示：

1. 失败原因。
2. 当前任务类型。
3. 已完成进度。
4. 重试按钮。

### 11.2 分章失败

允许用户：

1. 手动切分。
2. 重新识别。
3. 直接按长度粗分。

### 11.3 输出结构不完整

AI 返回不符合结构时：

1. 后端做 schema 校验。
2. 自动重试一次。
3. 仍失败则保存原始输出并提示用户。

## 12. 安全与合规

1. AI API Key 只保存在服务端环境变量。
2. 用户上传文本按项目隔离。
3. 模板只保存结构公式，不保存可疑的大段原文。
4. 输出必须避免鼓励照搬原作。
5. 删除项目时需要删除关联文本、章节、分析和状态数据。

## 13. MVP 开发顺序

第一轮开发建议按这个顺序：

1. 初始化 Next.js + TypeScript 项目。
2. 接入 PostgreSQL 和 ORM。
3. 建立核心 schema：projects、source_texts、chapters、ai_jobs。
4. 实现文本导入和自动分章。
5. 实现章节列表与编辑。
6. 封装 AI Provider。
7. 实现章节拆解任务。
8. 保存并展示章节分析结果。
9. 实现整书分析和公式提取。
10. 实现模板库。
11. 实现大纲生成。
12. 实现创作工作台状态表。
13. 实现任务卡、正文、台账、审稿闭环。

## 14. 第一版验收

第一版可以认为完成，当以下链路跑通：

```text
新建项目
↓
粘贴或上传小说文本
↓
自动分章
↓
选择前 30 章分析
↓
查看逐章拆解
↓
查看整书节奏
↓
提取故事公式
↓
保存模板
↓
选择新题材生成大纲
↓
进入创作工作台
↓
生成任务卡
↓
生成章节正文
↓
生成台账
↓
完成一致性审稿
```

## 15. 后续扩展

第一版稳定后，再考虑：

1. 用户账号和订阅计费。
2. 多模型选择。
3. 付费模板市场。
4. 团队协作。
5. 桌面客户端。
6. 本地隐私模式。
7. EPUB / DOCX 导入。
8. 向量检索增强长篇记忆。
