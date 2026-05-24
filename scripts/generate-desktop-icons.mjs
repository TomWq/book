import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const buildDir = path.join(root, "build");
const iconsetDir = path.join(buildDir, "icon.iconset");
const pngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

mkdirSync(buildDir, { recursive: true });

const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="156" y1="128" x2="868" y2="916" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#25314A"/>
      <stop offset="0.48" stop-color="#1F5EFF"/>
      <stop offset="1" stop-color="#15D68F"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(724 258) rotate(127) scale(524)">
      <stop offset="0" stop-color="#92F7D1" stop-opacity="0.95"/>
      <stop offset="0.36" stop-color="#4DBED0" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#0D1324" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="page" x1="298" y1="258" x2="710" y2="770" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.62" stop-color="#F2F7FF"/>
      <stop offset="1" stop-color="#CAD8FF"/>
    </linearGradient>
    <linearGradient id="mint" x1="540" y1="594" x2="794" y2="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#D6FFF1"/>
      <stop offset="0.48" stop-color="#35F1A1"/>
      <stop offset="1" stop-color="#0CB5C9"/>
    </linearGradient>
    <linearGradient id="edge" x1="512" y1="302" x2="512" y2="770" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.86"/>
      <stop offset="1" stop-color="#6F8CFF" stop-opacity="0.16"/>
    </linearGradient>
    <filter id="shadow" x="-18%" y="-18%" width="136%" height="136%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="34" stdDeviation="34" flood-color="#071022" flood-opacity="0.34"/>
    </filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect x="78" y="78" width="868" height="868" rx="206" fill="#111827"/>
  <rect x="96" y="96" width="832" height="832" rx="190" fill="url(#bg)"/>
  <rect x="96" y="96" width="832" height="832" rx="190" fill="url(#glow)"/>
  <circle cx="734" cy="268" r="112" fill="#B9FFE8" opacity="0.2" filter="url(#soft)"/>
  <path d="M246 314c0-39 31-70 70-70h160c49 0 91 26 113 65 22-39 64-65 113-65h18c39 0 70 31 70 70v410c0 39-31 70-70 70H599c-39 0-71 19-91 48-20-29-52-48-91-48H316c-39 0-70-31-70-70V314Z" fill="#0B1020" opacity="0.24" filter="url(#shadow)"/>
  <path d="M246 298c0-39 31-70 70-70h158c51 0 94 30 114 73v472c-26-29-63-45-107-45H316c-39 0-70-31-70-70V298Z" fill="url(#page)"/>
  <path d="M588 301c20-43 63-73 114-73h22c39 0 70 31 70 70v360c0 39-31 70-70 70H613c-8 0-16 1-25 2V301Z" fill="url(#page)"/>
  <path d="M588 300v474" stroke="url(#edge)" stroke-width="24" stroke-linecap="round"/>
  <path d="M336 388h142M336 486h160M336 584h128M678 388h34M678 486h42" stroke="#1C2740" stroke-opacity="0.68" stroke-width="34" stroke-linecap="round"/>
  <path d="M648 612c40-78 99-131 177-158-27 80-79 143-156 189l-79 47 58-78Z" fill="url(#mint)" filter="url(#shadow)"/>
  <path d="M651 615l56 55-117 60 61-115Z" fill="#E9FFF7"/>
  <path d="M610 713l-34 18 17-35 17 17Z" fill="#142033"/>
  <circle cx="771" cy="356" r="42" fill="#9DFFD8"/>
  <circle cx="817" cy="410" r="22" fill="#F8FFFD" opacity="0.95"/>
  <path d="M770 282v-56M770 486v-56M668 384h56M816 326l40-40M684 468l40-40" stroke="#DBFFF3" stroke-width="24" stroke-linecap="round" opacity="0.84"/>
</svg>
`;

writeFileSync(path.join(buildDir, "icon.svg"), `${svg}\n`, "utf8");

for (const size of pngSizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(buildDir, `icon-${size}.png`));
}

await sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .png()
  .toFile(path.join(buildDir, "icon.png"));

function buildIco() {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = sizes.map((size) => ({
    size,
    data: readFileSync(path.join(buildDir, `icon-${size}.png`))
  }));
  const headerSize = 6 + images.length * 16;
  const buffers = [Buffer.alloc(headerSize)];
  let offset = headerSize;

  buffers[0].writeUInt16LE(0, 0);
  buffers[0].writeUInt16LE(1, 2);
  buffers[0].writeUInt16LE(images.length, 4);

  images.forEach((image, index) => {
    const entryOffset = 6 + index * 16;
    buffers[0].writeUInt8(image.size === 256 ? 0 : image.size, entryOffset);
    buffers[0].writeUInt8(image.size === 256 ? 0 : image.size, entryOffset + 1);
    buffers[0].writeUInt8(0, entryOffset + 2);
    buffers[0].writeUInt8(0, entryOffset + 3);
    buffers[0].writeUInt16LE(1, entryOffset + 4);
    buffers[0].writeUInt16LE(32, entryOffset + 6);
    buffers[0].writeUInt32LE(image.data.length, entryOffset + 8);
    buffers[0].writeUInt32LE(offset, entryOffset + 12);
    offset += image.data.length;
    buffers.push(image.data);
  });

  writeFileSync(path.join(buildDir, "icon.ico"), Buffer.concat(buffers));
}

function buildIcns() {
  if (process.platform !== "darwin") {
    return;
  }

  rmSync(iconsetDir, { recursive: true, force: true });
  mkdirSync(iconsetDir, { recursive: true });

  const iconsetFiles = [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
    ["icon_512x512@2x.png", 1024]
  ];

  for (const [fileName, size] of iconsetFiles) {
    const source = path.join(buildDir, `icon-${size}.png`);
    const target = path.join(iconsetDir, fileName);
    writeFileSync(target, readFileSync(source));
  }

  execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", path.join(buildDir, "icon.icns")], {
    stdio: "inherit"
  });
  rmSync(iconsetDir, { recursive: true, force: true });
}

buildIco();
buildIcns();

if (!existsSync(path.join(buildDir, "icon.icns")) && process.platform === "darwin") {
  throw new Error("icon.icns 生成失败");
}

console.log("桌面端图标已生成到 build/");
