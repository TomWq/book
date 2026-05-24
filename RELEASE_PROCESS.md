# 客户端发布流程

当前正式发布方式：

```text
GitHub Actions 负责编译 Tauri 三端安装包
腾讯云 COS 存放安装包
授权中心服务器提供下载页、更新接口和下载中转
```

## 1. 改版本号

进入项目目录：

```bash
cd /Volumes/xinxin/book
```

每次新版先改版本号，不能复用旧版本号：

```text
package.json -> version
src-tauri/tauri.conf.json -> version
```

例如从 `1.0.0` 改成 `1.0.1`。

## 2. 本地检查

```bash
npm run typecheck
npm run acceptance
```

如果只是非常小的改动，也至少跑：

```bash
npm run typecheck
```

## 3. 推送代码

GitHub Actions 只构建 GitHub 上的代码，所以本地改完要提交并推到 `main`。

```bash
git status
git add .
git commit -m "release v1.0.1"
git push origin main
```

## 4. 触发三端打包

```bash
npm run release:tauri
```

查看最近的打包任务：

```bash
npm run release:tauri:status
```

也可以在 GitHub 页面看：

```text
Actions -> Tauri Release
```

成功后会生成一个 GitHub Draft Release，包含：

```text
Windows x64 Setup.exe
macOS Apple 芯片 DMG
macOS Intel DMG
```

## 5. 下载发布包到本地

GitHub Release 里的文件名可能会被简化，所以不要直接拿它的名字发布。执行：

```bash
npm run release:download
```

它会下载并整理到当前版本专用目录，例如 `release/packages/v1.0.1/`：

```text
AI网文写作助手-Setup-版本号-x64.exe
AI网文写作助手-版本号-arm64-mac.dmg
AI网文写作助手-版本号-x64-mac.dmg
```

## 6. 上传安装包到 COS

打开腾讯云 COS 桶：

```text
ai-novel-downloads-1253439621
ap-beijing
```

把 `release/packages/v版本号/` 里的三个安装包上传到 COS。

这个目录里会有一个 `UPLOAD_THESE_FILES.txt` 说明文件，不需要上传它。

旧包不要马上删除，建议至少保留最近 2 到 3 个版本，方便回滚。

## 7. 发布下载清单

安装包上传 COS 后，发布 manifest：

```bash
DOWNLOAD_BASE_URL="https://ai-novel-downloads-1253439621.cos.ap-beijing.myqcloud.com" npm run downloads:manifest
```

这个命令只同步 `manifest.json` 到授权中心服务器，不会上传大安装包。

如果只想本地预览下载页清单：

```bash
DOWNLOAD_BASE_URL="https://ai-novel-downloads-1253439621.cos.ap-beijing.myqcloud.com" npm run downloads:local
```

## 8. 线上验证

打开下载页：

```text
http://62.234.205.107/download
```

检查：

```text
版本号是否正确
三个下载按钮是否可下载
下载速度是否走 COS
```

再检查更新清单：

```text
http://62.234.205.107/api/app/update/manifest
```

正常情况下，接口里应该是 `/api/download/*` 中转地址，不应该直接暴露 COS 原始地址。

## 9. 最短流程

日常最常用就是：

```bash
npm run typecheck
npm run acceptance
git add .
git commit -m "release v1.0.1"
git push origin main
npm run release:tauri
npm run release:tauri:status
npm run release:download
```

然后上传 `release/packages/v版本号/` 里的三个安装包到 COS，最后：

```bash
DOWNLOAD_BASE_URL="https://ai-novel-downloads-1253439621.cos.ap-beijing.myqcloud.com" npm run downloads:manifest
```

## 10. 回滚

如果新版有问题，不需要删除 COS 新包。把 `manifest.json` 指回上一个稳定版本，再重新执行：

```bash
DOWNLOAD_BASE_URL="https://ai-novel-downloads-1253439621.cos.ap-beijing.myqcloud.com" npm run downloads:manifest
```
