# 轻量授权中心部署说明

这个服务端只负责管理员登录、授权码生成、客户端激活校验和激活记录保存，不在服务器上跑 AI。

推荐线上组合：

1. 轻量云服务器运行 Next.js。
2. SQLite 文件保存授权码和登录会话。
3. Nginx 反向代理到 Node 服务。
4. 定期备份 SQLite 数据库文件。

## 1. 环境变量

服务器 `.env` 建议：

```env
APP_RUNTIME="cloud"
APP_AUTH_PROVIDER="local"
APP_BILLING_MODE="subscription"
AUTH_COOKIE_SECURE="false"

DATABASE_URL="file:/www/wwwroot/book/data/license-center.db"
APP_STORE_PATH="/www/wwwroot/book/data/app-db.json"

ADMIN_EMAILS="你的管理员邮箱"
JOB_WORKER_TOKEN="一串足够长的随机密钥"

AI_PROVIDER_NAME=""
AI_BASE_URL=""
AI_API_KEY=""
AI_MODEL=""
AI_TIMEOUT_MS="60000"
```

说明：

1. `APP_RUNTIME="cloud"`：让服务器作为授权中心运行。
2. `APP_AUTH_PROVIDER="local"`：使用本机邮箱密码登录。
3. `AUTH_COOKIE_SECURE="false"`：临时使用 `http://IP` 访问时需要关闭；配置 HTTPS 域名后建议改为 `true`。
4. `DATABASE_URL`：SQLite 文件路径，必须放在服务器持久化目录里。
5. `APP_STORE_PATH`：主状态文件，建议也放在同一个持久化目录里。
6. `ADMIN_EMAILS`：这里填写的邮箱注册后自动拥有管理员权限。

## 2. 首次启动

```bash
npm install
npm run build
npm run start
```

访问：

```text
http://服务器IP:3000/register
```

用 `ADMIN_EMAILS` 里配置的邮箱注册，然后进入：

```text
http://服务器IP:3000/admin
```

## 3. PM2 常驻运行

```bash
npm install -g pm2
pm2 start npm --name book-license-center -- start
pm2 save
pm2 startup
```

## 3.1 一键部署

本地先复制一次配置：

```bash
cp deploy.config.example.json deploy.config.json
```

然后把里面的服务器地址、路径和服务名填好，以后每次改完直接执行：

```bash
npm run deploy:server
```

这个脚本会自动：

1. 同步代码到服务器。
2. 在服务器执行 `npm ci` 和 `npm run build`。
3. 重启 `myapp.service`，如果没有这个 systemd 服务就回退到 `pm2`。

前提是服务器已经能从本机连上 SSH 22 端口。

## 4. 客户端激活地址

客户端的 `LICENSE_SERVER_URL` 填你的授权中心域名：

```env
LICENSE_SERVER_URL="https://你的域名"
```

客户端会请求：

```text
POST /api/license/activate
```

这个接口是公开接口，不需要管理员登录。

## 5. 备份

SQLite 数据都在 `DATABASE_URL` 指向的文件里，例如：

```text
/www/wwwroot/book/data/license-center.db
```

建议每天备份这个文件。迁移服务器时，只要带走 `.env` 和这个数据库文件即可。

## 6. 部署后检查

```text
https://你的域名/api/health
```

然后检查：

1. 注册管理员账号。
2. 登录 `/admin`。
3. 生成一个授权码。
4. 在客户端输入授权码完成激活。
5. 回到 `/admin` 查看激活记录和设备绑定。
