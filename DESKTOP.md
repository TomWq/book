# 作者端 Electron 客户端说明

当前客户端采用 Electron 外壳承载现有 Next 作者端，管理端仍部署在云端授权中心。

## 架构

```text
Electron 主进程
  启动窗口、设置桌面端环境变量、准备本地数据目录

Node 子进程
  使用随包携带的 Node runtime 启动本地 Next 服务

Next 作者端
  复用现有页面、授权激活、项目中心、创作工作台和 AI 设置

本机 SQLite
  默认保存在 Electron userData/data 目录

云端授权中心
  继续通过 LICENSE_SERVER_URL 校验激活码、到期和作废状态
```

## 本地开发

```bash
npm run desktop:dev
```

这个命令会启动 Next dev server，并自动打开 Electron 窗口。

## 生产预览

```bash
npm run desktop:preview
```

这个命令会生成图标、执行 `next build`、清理 Next 开发缓存，再由 Electron 主进程启动内置 Next 服务。

## 打包

```bash
npm run desktop:dist
```

当前打包配置使用 `electron-builder`，产物输出到 `release/`。第一版为了让 Next 服务和原生依赖更稳定，暂时关闭 asar 压缩。

macOS 内测包默认输出 zip，不默认输出 dmg。DMG 更适合放到签名、公证和自动更新流程一起处理。

当前 macOS 包会在 `scripts/after-pack.mjs` 里执行 ad-hoc 签名：

```text
codesign --force --deep --sign -
```

这只能保证 `.app` 资源签名完整，避免内测包因为 bundle 签名不完整被系统直接判定为损坏；它不是 Apple Developer ID 签名，也没有 notarization 公证。正式对外分发前仍建议接入 Developer ID Application 签名和 Apple 公证。

客户端使用 Electron 42 作为壳，`better-sqlite3` 运行在随包携带的 Node 22 子进程中，避免原生 SQLite 模块绑定 Electron ABI。

常用命令：

```bash
npm run desktop:dist:release
npm run desktop:dist:mac:dir
npm run desktop:dist:mac
npm run desktop:dist:mac:arm64
npm run desktop:dist:mac:x64
npm run desktop:dist:win
```

`desktop:dist:release` 是发布用一键命令，会依次输出 Windows x64、macOS arm64、macOS x64 三个内测包，并在结束后运行发布前自检。这个命令需要在 macOS 上执行，因为 Windows 机器不能构建 macOS 安装包。

`desktop:dist:win` 固定输出大众 Windows x64 安装包，不跟随当前机器架构打 arm64。

macOS 用户按芯片类型分包：

```text
M1 / M2 / M3 / M4 等苹果芯片：npm run desktop:dist:mac:arm64
Intel 芯片 Mac：npm run desktop:dist:mac:x64
```

当前项目包含 `better-sqlite3` 原生模块，暂不建议直接打 universal 通用包。发布时优先分别提供 arm64 和 x64 两个 macOS 包，避免某一类 Mac 启动后本地服务起不来。

打完包后建议执行发布前自检：

```bash
npm run release:check
```

默认检查 Windows x64 发布物。需要单独检查其他平台时可以使用：

```bash
npm run release:check:win
npm run release:check:mac
npm run release:check:mac:arm64
npm run release:check:mac:x64
npm run release:check:all
```

`desktop:dist*` 会统一进入 `scripts/desktop-build.mjs`，自动完成：

```text
生成桌面端图标
执行 Next standalone 生产构建
清理 .next/dev 和 .next/cache
按目标平台准备随包 Node runtime
按目标平台准备 better-sqlite3 原生模块
设置 Electron / electron-builder 国内镜像
在系统 npm 不可用时准备本地 npm shim
调用 electron-builder 输出安装包
```

如果需要临时覆盖 npm 下载地址，可以设置：

```bash
NPM_TARBALL_URL=https://registry.npmmirror.com/npm/-/npm-11.6.2.tgz npm run desktop:dist:mac:dir
```

当前验证过的 macOS 目录版 `.app` 大约 450MB，其中 Electron/Chromium 约 270MB，随包 Node runtime 约 110MB，业务运行目录约 70MB。压缩后的 zip 安装包通常会明显更小。

## 手动更新发布

当前发版流程已经整理到 `RELEASE_PROCESS.md`。以后正式发布客户端优先看那份文档；本节只保留原理说明和旧流程参考。

当前内测阶段先使用“检查更新 + 手动下载安装”的方式，不启用自动静默更新。客户端会请求授权中心的公开接口：

```text
GET /api/app/update/manifest
```

授权中心部署环境里配置下面变量后，客户端设置页的“检查更新”会显示新版信息和下载入口：

```bash
APP_LATEST_VERSION=1.0.1
APP_LATEST_RELEASE_DATE=2026-05-23T12:00:00.000Z
APP_LATEST_RELEASE_NOTES="修复章节生成和审稿稳定性问题。"
APP_UPDATE_REQUIRED=false
APP_UPDATE_DOWNLOAD_WIN_URL=https://example.com/downloads/AI网文写作助手-Setup-1.0.1-x64.exe
APP_UPDATE_DOWNLOAD_MAC_ARM64_URL=https://example.com/downloads/AI网文写作助手-1.0.1-arm64-mac.zip
APP_UPDATE_DOWNLOAD_MAC_X64_URL=https://example.com/downloads/AI网文写作助手-1.0.1-x64-mac.zip
```

如果你不想使用授权中心，也可以在客户端配置 `APP_UPDATE_MANIFEST_URL` 指向一个可访问的 JSON 文件。JSON 结构如下：

```json
{
  "productName": "AI 网文写作助手",
  "version": "1.0.1",
  "notes": "修复章节生成和审稿稳定性问题。",
  "releaseDate": "2026-05-23T12:00:00.000Z",
  "required": false,
  "downloads": {
    "win32X64": "https://example.com/downloads/AI网文写作助手-Setup-1.0.1-x64.exe",
    "darwinArm64": "https://example.com/downloads/AI网文写作助手-1.0.1-arm64-mac.zip",
    "darwinX64": "https://example.com/downloads/AI网文写作助手-1.0.1-x64-mac.zip"
  }
}
```

每次发布新版的基本顺序：

1. 修改 `package.json` 版本号。
2. 执行 `npm run deploy:server`，把下载中心页面和接口部署到服务器。
3. 执行 `npm run desktop:dist:release`，打 Windows x64、macOS arm64、macOS x64 三个包。
4. 执行 `npm run desktop:publish`，把三个安装包上传到服务器下载目录，并生成下载清单。
5. 打开 `/download`，确认三个下载按钮都能正常下载。

`desktop:publish` 默认会读取 `deploy.config.json` 或 `DEPLOY_HOST / DEPLOY_USER / DEPLOY_PATH / DEPLOY_PORT`，上传到服务器：

```text
<DEPLOY_PATH>/public/downloads/
```

下载地址默认按 `http://<DEPLOY_HOST>/downloads` 生成。如果你有正式域名，可以发布时指定：

```bash
DOWNLOAD_BASE_URL=https://你的域名/downloads npm run desktop:publish
```

上传脚本会同时生成：

```text
public/downloads/manifest.json
release/download-manifest.json
```

授权中心的 `/api/app/update/manifest` 会优先读取服务器上的 `public/downloads/manifest.json`，所以客户端“检查更新”和下载中心页面会自动同步到最新发布包。

## 品牌资源

桌面端图标由脚本生成：

```bash
npm run desktop:icons
```

生成文件位于 `build/`：

```text
icon.icns  macOS 安装包图标
icon.ico   Windows 安装包图标
icon.png   Electron 窗口运行时图标
icon.svg   源图
```

## 数据目录

Electron 启动时会设置：

```text
APP_RUNTIME=desktop
AUTH_COOKIE_SECURE=false
APP_STORE_PATH=<userData>/data/app-db.json
DATABASE_URL=file:<userData>/data/license-center.db
```

如果手动设置了 `APP_STORE_PATH` 或 `DATABASE_URL`，会优先使用手动配置。

## 后续需要补齐

1. macOS Developer ID 公证 / Windows Authenticode 签名。
2. 自动静默更新。
3. DMG 和自动更新发布流程。
