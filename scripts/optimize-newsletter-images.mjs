import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const runId = process.argv[2];

if (!runId) {
  console.error("Usage: node scripts/optimize-newsletter-images.mjs YYYY-MM-DD");
  process.exit(1);
}

const repoRoot = process.cwd();
const imagesDir = path.join(repoRoot, "public", "newsletter", runId, "images");

const WIDTH = 1040;
const HEIGHT = 300;
const MAX_BYTES = 350 * 1024;
const QUALITIES = [78, 74, 70, 66, 62, 58, 54, 50];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findSource(index) {
  const candidates = [
    `article-${index}.png`,
    `article-${index}.jpeg`,
    `article-${index}.jpg`,
    `article-${index}.webp`
  ];

  for (const name of candidates) {
    const filePath = path.join(imagesDir, name);
    if (await exists(filePath)) return filePath;
  }

  throw new Error(`Missing source image for article-${index}. Expected png/jpg/jpeg/webp in ${imagesDir}`);
}

async function saveOptimized(sourcePath, outputPath, tempPath, quality) {
  await sharp(sourcePath)
    .resize(WIDTH, HEIGHT, {
      fit: "cover",
      position: "attention"
    })
    .jpeg({
      quality,
      mozjpeg: true
    })
    .toFile(tempPath);

  const stat = await fs.stat(tempPath);
  return stat.size;
}

async function finalize(tempPath, outputPath) {
  await fs.rm(outputPath, { force: true });
  await fs.rename(tempPath, outputPath);
}

async function optimizeImage(index) {
  const sourcePath = await findSource(index);
  const outputPath = path.join(imagesDir, `article-${index}.jpg`);
  const tempPath = path.join(imagesDir, `article-${index}.tmp.jpg`);

  let lastResult = null;

  for (const quality of QUALITIES) {
    const bytes = await saveOptimized(sourcePath, outputPath, tempPath, quality);
    lastResult = { quality, bytes };

    if (bytes <= MAX_BYTES) {
      await finalize(tempPath, outputPath);
      console.log(`article-${index}.jpg OK — ${Math.round(bytes / 1024)} KB at quality ${quality}`);
      return;
    }

    await fs.rm(tempPath, { force: true });
  }

  const bytes = await saveOptimized(sourcePath, outputPath, tempPath, lastResult.quality);
  await finalize(tempPath, outputPath);

  console.warn(`article-${index}.jpg saved but still large — ${Math.round(bytes / 1024)} KB at quality ${lastResult.quality}`);
}

await fs.mkdir(imagesDir, { recursive: true });

for (let i = 1; i <= 5; i++) {
  await optimizeImage(i);
}

console.log("Newsletter images optimized.");
