# Tauri 桌面壳说明

这个目录是当前正式桌面端的 Tauri 外壳：

```text
Tauri 负责桌面窗口、启动页和进程生命周期
现有 Next standalone 继续作为本地服务运行
本地 SQLite、授权、页面和业务逻辑继续复用现有代码
```

当前发布流程已经切到 GitHub Actions 构建 Tauri 三端安装包。正式发版步骤见 `RELEASE_PROCESS.md`。

## 当前目标

先验证 4 件事：

```text
1. Tauri 能否稳定拉起现有 Next 本地服务。
2. Windows / macOS 包体积能降多少。
3. 启动动画、启动速度和白屏概率是否更好。
4. 本地 SQLite、授权激活和创作流程是否正常。
```

## 前置条件

Tauri 必须安装 Rust 工具链。当前机器如果没有 `cargo`，先安装 Rust：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

安装后重新打开终端，确认：

```bash
cargo --version
rustc --version
```

macOS 还需要 Xcode Command Line Tools：

```bash
xcode-select --install
```

## 开发预览

```bash
npm run tauri:dev
```

这个命令会先执行：

```bash
npm run tauri:prepare
```

然后启动 Tauri。

如果你想临时接一个已经启动的 Next dev server，可以先开：

```bash
npm run dev:desktop
```

再执行：

```bash
TAURI_NEXT_URL="http://localhost:3000" tauri dev
```

## 打包测试

```bash
npm run tauri:build
```

也可以分别打 macOS 两种架构：

```bash
npm run tauri:build:mac:arm64
npm run tauri:build:win:x64
```

这两个命令会自动做三件事：

```text
1. 按目标架构准备 Tauri 专用 Node runtime。
2. 按目标架构替换 standalone 里的 better-sqlite3 原生模块。
3. 调用 tauri build --target 构建对应的 Rust 桌面壳。
```

Windows 包推荐通过 GitHub Actions 构建。项目里已经加了：

```text
.github/workflows/tauri-release.yml
```

推送 `v*` 标签或在 GitHub Actions 页面手动运行 `Tauri Release`，它会用矩阵任务分别构建：

```text
macOS arm64
Windows x64
```

每个任务都会先执行：

```bash
node scripts/tauri-build.mjs --prepare-only ...
```

用来准备对应平台/架构的 Node runtime、Next standalone 静态资源和 `better-sqlite3` 原生模块，然后再交给 `tauri-apps/tauri-action` 打包并上传到 GitHub Release 草稿。

产物通常会在：

```text
src-tauri/target/release/bundle/
```

GitHub Actions 成功后，再执行 `npm run release:download`，会把三端安装包整理到：

```text
release/packages/v版本号/
```

当前在 macOS arm64 上的 Tauri 实测结果：

```text
Tauri arm64 .app：184MB
Tauri arm64 DMG：60MB
Tauri x64 .app：187MB
Tauri x64 DMG：61MB
```

最终给用户下载的就是 `release/packages/v版本号/` 里的三个文件。

## 启动与日志

Tauri 包启动时会先显示 `public/tauri-placeholder/index.html`，后台拉起本地 Next standalone 服务，服务就绪后再自动跳转到工作台页面。这样用户看到的是启动动画，而不是白屏。

当前启动体验是两段式：

```text
1. 先显示一个 560x420 的启动小窗。
2. 本地 Next 服务就绪后，创建隐藏的主窗口。
3. 主窗口页面加载完成后显示主窗口，并隐藏启动小窗。
```

这样可以避免“主窗口先露出来，里面还没渲染好”的空白感。

本地 Next 服务会通过 `src-tauri/node-server-wrapper.cjs` 启动。这个包装器会持续检查 Tauri 父进程是否还活着，避免桌面壳异常退出后留下孤儿 `next-server`。

运行日志会写入应用数据目录：

```text
macOS: ~/Library/Application Support/com.ai-novel-workbench.tauri/logs/tauri.log
Windows: %APPDATA%/com.ai-novel-workbench.tauri/logs/tauri.log
```

桌面菜单里有：

```text
帮助 -> 打开日志目录
```

用户反馈“打不开、白屏、卡启动”时，优先让用户把这个目录里的 `tauri.log` 发回来。

## 进程回收检查

Tauri 关闭主窗口或退出应用时，会同步关闭本地 Next 进程。macOS 本机可以这样抽查：

```bash
ps aux | rg 'ai-novel-workbench-tauri|next-server|node-runtime' | rg -v rg
lsof -nP -iTCP -sTCP:LISTEN | rg 'next-server|node|313'
```

正常退出后，不应该继续看到这个 Tauri 包拉起的 `next-server` 或 `node-runtime` 监听 313x 端口。

## macOS 可移除卷权限提示

如果从 `/Volumes/...` 路径启动，比如外置硬盘、DMG 挂载卷，macOS 可能提示应用想访问可移除宗卷上的文件。这个提示通常来自系统隐私保护，不代表应用在读取用户资料；它也可能只是读取自己 App Bundle 里的 Next、Node、SQLite 原生模块等资源。

正式给用户安装时，建议让用户把 App 拖到 `/Applications` 后再打开。后续如果做 Apple Developer ID 签名和公证，这类提示也会更少。

## 注意

这个原型仍然会携带：

```text
Node runtime
Next standalone
better-sqlite3 原生模块
```

所以它不会小到几 MB，主要体积来自本地 Node runtime、Next standalone 和原生模块。

当前已经支持在 Apple Silicon Mac 上分别构建 macOS arm64 和 macOS x64 Tauri 包。Windows Tauri 包建议走 GitHub Actions，或者在 Windows 环境执行：

```bash
npm run tauri:build:win:x64
```

原因是 Tauri 的 Windows 安装包更适合 Windows 原生 runner 构建；macOS 本机跨编译 Windows 虽然官方有实验方案，但依赖 `cargo-xwin`、NSIS、LLVM，稳定性和维护成本都不如 GitHub Actions 矩阵构建。

如果只换外壳后体积下降不明显，说明真正占空间的是 Node runtime、Next standalone 和原生依赖；那时再考虑是否值得继续深入。
