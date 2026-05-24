import { createHash } from "node:crypto";
import os from "node:os";

const MACHINE_ID_NAMESPACE = "ai-novel-workbench-license-v1";

function hashMachineSource(source: string) {
  return createHash("sha256")
    .update(MACHINE_ID_NAMESPACE)
    .update(":")
    .update(source.trim())
    .digest("hex");
}

export function getDesktopMachineHash() {
  const desktopMachineHash = process.env.DESKTOP_MACHINE_HASH?.trim();

  if (desktopMachineHash) {
    return desktopMachineHash;
  }

  return hashMachineSource([
    "development",
    os.hostname(),
    os.platform(),
    os.arch()
  ].join(":"));
}

