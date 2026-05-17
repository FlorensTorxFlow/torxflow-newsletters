import fs from "node:fs/promises";
import sharp from "sharp";

async function optimizeHeader() {
  const input = "public/assets/header/torxflow-news-header.png";
  const output = "public/assets/header/torxflow-news-header.tmp.png";

  await sharp(input)
    .resize({
      width: 1104,
      withoutEnlargement: true
    })
    .png({
      compressionLevel: 9,
      palette: true,
      colors: 128
    })
    .toFile(output);

  await fs.rm(input, { force: true });
  await fs.rename(output, input);

  const stat = await fs.stat(input);
  console.log(`Header optimized: ${Math.round(stat.size / 1024)} KB`);
}

async function optimizeLogo() {
  const input = "public/assets/logo/torxflow-mark.png";
  const output = "public/assets/logo/torxflow-mark.tmp.png";

  await sharp(input)
    .resize(64, 64, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({
      compressionLevel: 9,
      palette: true,
      colors: 128
    })
    .toFile(output);

  await fs.rm(input, { force: true });
  await fs.rename(output, input);

  const stat = await fs.stat(input);
  console.log(`Logo optimized: ${Math.round(stat.size / 1024)} KB`);
}

await optimizeHeader();
await optimizeLogo();

console.log("Standard newsletter assets optimized.");
