import { rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const targets = [
  ".next/dev",
  ".next/cache"
];

for (const target of targets) {
  const fullPath = path.join(root, target);
  await rm(fullPath, { recursive: true, force: true });
  console.log(`已清理 ${target}`);
}
