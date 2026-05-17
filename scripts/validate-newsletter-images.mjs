import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const runId = process.argv[2];

if (!runId) {
  console.error("Usage: node scripts/validate-newsletter-images.mjs YYYY-MM-DD");
  process.exit(1);
}

const repoRoot = process.cwd();
const imagesDir = path.join(repoRoot, "public", "newsletter", runId, "images");

const WIDTH = 1040;
const HEIGHT = 300;
const MAX_BYTES = 350 * 1024;

let failed = false;

for (let i = 1; i <= 5; i++) {
  const filePath = path.join(imagesDir, `article-${i}.jpg`);

  try {
    const stat = await fs.stat(filePath);
    const meta = await sharp(filePath).metadata();

    const sizeKb = Math.round(stat.size / 1024);
    const dimensionsOk = meta.width === WIDTH && meta.height === HEIGHT;
    const sizeOk = stat.size <= MAX_BYTES;

    if (!dimensionsOk || !sizeOk) {
      failed = true;
      console.error(
        `FAIL article-${i}.jpg — ${meta.width}x${meta.height}, ${sizeKb} KB`
      );
    } else {
      console.log(
        `OK article-${i}.jpg — ${meta.width}x${meta.height}, ${sizeKb} KB`
      );
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL article-${i}.jpg — missing or unreadable`);
  }
}

if (failed) {
  console.error("Newsletter image validation failed.");
  process.exit(1);
}

console.log("Newsletter image validation passed.");
