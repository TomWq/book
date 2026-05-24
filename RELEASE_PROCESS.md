# 客户端发布流程

这份文档只记录正式发新版时要照着走的步骤。当前发布方式是：

```text
安装包放腾讯云 COS
下载页和更新接口放授权中心服务器
下载页按钮走 /api/download/* 中转
服务器根据 manifest 跳转到 COS
```

## 1. 发布前确认

进入项目目录：

```bash
cd /Volumes/xinxin/book
```

确认这次要发布的版本号，比如 `1.0.1`。版本号要改这里：

```text
package.json -> version
```

不要复用旧版本号。每次新版都使用新的文件名，例如：

```text
AI网文写作助手-Setup-1.0.1-x64.exe
AI网文写作助手-1.0.1-arm64-mac.zip
AI网文写作助手-1.0.1-x64-mac.zip
```

## 2. 本地检查

建议每次发布前先跑：

```bash
npm run typecheck
npm run acceptance
```

如果只是小改动，也至少跑：

```bash
npm run typecheck
```

## 3. 部署服务器代码

如果这次改了下载页、授权中心、更新接口、后台页面，先部署服务器代码：

```bash
npm run deploy:server
```

注意：这个命令不会上传安装包，也不会覆盖 `public/downloads` 里的下载清单。

## 4. 打三端安装包

执行发布打包：

```bash
npm run desktop:dist:release
```

这个命令会生成 3 个常用包：

```text
Windows x64
macOS Apple 芯片 arm64
macOS Intel x64
```

产物在：

```text
release/
```

注意：`desktop:dist:release` 只负责生成安装包，不会把安装包复制到 `public/downloads/`。

当前流程里，`public/downloads/` 只保留 `manifest.json`；真正的大安装包放在腾讯云 COS。

打包完成后可以再检查一次：

```bash
npm run release:check:all
```

## 5. 上传安装包到 COS

打开腾讯云 COS 桶：

```text
ai-novel-downloads-1253439621
ap-beijing
```

把 `release/` 里的 3 个安装包上传到 COS。

旧包不要马上删除。建议至少保留最近 2 到 3 个版本，方便回滚，也避免旧链接突然 404。

上传规则：

```text
新版本上传新文件名
不要覆盖旧版本同名文件
不要把 1.0.1 的内容上传成 1.0.0 的文件名
```

## 6. 发布下载清单

安装包上传 COS 后，执行：

```bash
DOWNLOAD_BASE_URL="https://ai-novel-downloads-1253439621.cos.ap-beijing.myqcloud.com" npm run desktop:publish:manifest
```

这个命令只发布 `manifest.json`，不会把大安装包上传到服务器。

它会做三件事：

```text
生成 public/downloads/manifest.json
生成 release/download-manifest.json
同步 manifest.json 到授权中心服务器
```

线上下载页和客户端检查更新都依赖这个 manifest。

如果这里提示：

```text
发布包比桌面图标资源旧
```

说明 `release/` 里的安装包不是最新打出来的，不能继续发布。先重新执行：

```bash
npm run desktop:dist:release
```

然后再上传新版安装包到 COS，最后重新执行 `desktop:publish:manifest`。

## 7. 线上验证

打开下载页：

```text
http://62.234.205.107/download
```

检查 3 件事：

```text
1. 页面版本号是否是新版本。
2. 三个下载按钮是否都能开始下载。
3. 下载速度是否走 COS，速度是否正常。
```

再检查更新清单：

```text
http://62.234.205.107/api/app/update/manifest
```

正常情况下，里面应该看到：

```text
/api/download/windows
/api/download/mac-arm64
/api/download/mac-x64
```

不应该直接把 COS 原始地址暴露给下载页和客户端更新接口。

## 8. 下载保护

当前下载按钮会先访问服务器中转接口：

```text
/api/download/windows
/api/download/mac-arm64
/api/download/mac-x64
```

默认限流：

```text
同一个 IP、同一个安装包，1 小时最多 12 次
```

可以在服务器环境变量里调整：

```bash
DOWNLOAD_RATE_LIMIT_MAX=12
DOWNLOAD_RATE_LIMIT_WINDOW_MS=3600000
```

如果以后要让下载链接真正 5 分钟过期，需要：

```text
1. 把 COS 桶改成私有读。
2. 在服务器配置 COS_SECRET_ID 和 COS_SECRET_KEY。
3. 保持 DOWNLOAD_REDIRECT_TTL_SECONDS=300。
```

示例：

```bash
COS_SECRET_ID="你的 SecretId"
COS_SECRET_KEY="你的 SecretKey"
DOWNLOAD_REDIRECT_TTL_SECONDS=300
```

## 9. CDN 域名备案通过后

备案通过、CDN 域名可用后，不需要改安装包文件名，只需要发布 manifest 时换成 CDN 域名：

```bash
DOWNLOAD_BASE_URL="https://你的下载域名" npm run desktop:publish:manifest
```

仍然建议安装包使用版本号文件名，避免 CDN 缓存导致用户下到旧包。

## 10. 回滚

如果新版有问题：

```text
1. 不需要删除 COS 新包。
2. 重新把 manifest 指回上一个稳定版本。
3. 再执行 desktop:publish:manifest 或手动恢复服务器 public/downloads/manifest.json。
```

所以每次发布后，建议把这两个文件留好：

```text
release/download-manifest.json
public/downloads/manifest.json
```

## 11. 每次发布最短命令清单

如果代码已经确认没问题，最常用就是这几步：

```bash
cd /Volumes/xinxin/book
npm run typecheck
npm run acceptance
npm run deploy:server
npm run desktop:dist:release
```

然后手动上传 3 个安装包到 COS。

最后执行：

```bash
DOWNLOAD_BASE_URL="https://ai-novel-downloads-1253439621.cos.ap-beijing.myqcloud.com" npm run desktop:publish:manifest
```

打开线上下载页验证即可。
