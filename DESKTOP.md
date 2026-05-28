# 作者端 Tauri 客户端说明

当前客户端采用 Tauri 外壳承载现有 Next 作者端，管理端仍部署在云端授权中心。

## 架构

```text
Tauri 桌面壳
  启动页、窗口生命周期、菜单、日志目录

Node 子进程
  使用随包携带的 Node runtime 启动本地 Next standalone 服务

Next 作者端
  复用现有页面、授权激活、项目中心、创作工作台和 AI 设置

本机 SQLite
  默认保存在应用数据目录

云端授权中心
  继续通过 LICENSE_SERVER_URL 校验激活码、到期和作废状态
```

## 本地开发

```bash
npm run tauri:dev
```

如果只想看网页端桌面运行态：

```bash
npm run dev:desktop
```

## 本地打包测试

macOS 本机可以打两个 Mac 包：

```bash
npm run tauri:build:mac:arm64
```

Windows 包建议走 GitHub Actions 原生 Windows runner：

```bash
npm run release:tauri
npm run release:tauri:status
```

GitHub Actions 会构建：

```text
macOS Apple 芯片 DMG
macOS Apple 芯片 updater 包和 .sig
Windows x64 NSIS Setup.exe
Windows x64 Setup.exe.sig
```

## 正式发布

正式发布流程见：

```text
RELEASE_PROCESS.md
```

最常用命令：

```bash
npm run typecheck
npm run acceptance
npm run release:tauri
npm run release:tauri:status
npm run release:download
```

然后按 `release/packages/v版本号/UPLOAD_THESE_FILES.txt` 上传安装包、updater 包和 `.sig` 到 COS，最后发布下载清单：

```bash
DOWNLOAD_BASE_URL="https://book-1253439621.cos.ap-beijing.myqcloud.com" npm run downloads:manifest
```

## 品牌资源

桌面端图标源文件保存在 `build/`：

```text
icon.icns  macOS 安装包图标
icon.ico   Windows 安装包图标
icon.png   运行时图标
icon.svg   源图
```

如需重新生成图标：

```bash
npm run icons:generate
```

## 启动与日志

客户端启动时会先显示启动页，后台拉起本地 Next 服务。服务就绪后显示主窗口，避免用户看到空白窗口。

运行日志在应用数据目录：

```text
macOS: ~/Library/Application Support/com.ai-novel-workbench.tauri/logs/tauri.log
Windows: %APPDATA%/com.ai-novel-workbench.tauri/logs/tauri.log
```

桌面菜单里有：

```text
帮助 -> 打开日志目录
```

用户反馈打不开、白屏、卡启动时，优先让用户导出这个日志。

## 后续需要补齐

1. macOS Developer ID 签名和公证。
2. Windows Authenticode 签名。
3. HTTPS 域名就绪后，把 updater endpoint 从 HTTP 切到 HTTPS。
