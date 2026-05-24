import { execFileSync } from "node:child_process";
import path from "node:path";

function log(message) {
  console.log(`[after-pack] ${message}`);
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  const identity = String(process.env.MAC_CODE_SIGN_IDENTITY || "-").trim() || "-";

  log(`为 macOS app 写入代码签名：${appPath}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", identity, appPath], {
    stdio: "inherit"
  });
  execFileSync("codesign", ["--verify", "--deep", "--verbose=2", appPath], {
    stdio: "inherit"
  });
}
