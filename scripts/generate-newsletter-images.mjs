import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

const runDate = process.argv[2];
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_ARTICLE_FIELDS = ["index", "title", "sourceUrl", "imageAlt"];
const EXPECTED_ARTICLE_COUNT = 5;

const repoRoot = process.cwd();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function trimSurroundingQuotes(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if ((first === `"` && last === `"`) || (first === "'" && last === "'") || (first === "`" && last === "`")) {
    return value.slice(1, -1);
  }

  return value;
}

async function loadEnvLocal(rootDir) {
  const envPath = path.join(rootDir, ".env.local");

  if (!(await exists(envPath))) {
    return;
  }

  const raw = await fs.readFile(envPath, "utf8");

  for (const line of raw.replace(/^\uFEFF/, "").split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    process.env[key] = trimSurroundingQuotes(line.slice(separatorIndex + 1).trim());
  }
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    fail(`Could not read or parse ${filePath}: ${error.message}`);
  }
}

function validateRunDate(value) {
  if (!value || !DATE_PATTERN.test(value)) {
    fail("Usage: node scripts/generate-newsletter-images.mjs YYYY-MM-DD [--force] [--dry-run]");
  }
}

function extractArticleConceptPrompt(article) {
  const sourcePrompt = hasText(article.image?.conceptPrompt) ? article.image.conceptPrompt : article.imagePrompt;

  if (!hasText(sourcePrompt)) {
    return "";
  }

  const marker = "Now depict:";
  const markerIndex = sourcePrompt.lastIndexOf(marker);
  const conceptPrompt = markerIndex === -1 ? sourcePrompt : sourcePrompt.slice(markerIndex + marker.length);

  return conceptPrompt.trim().replace(/["'`]+$/u, "").trim();
}

function validateArticles(data, dataPath) {
  const articles = Array.isArray(data.articles) ? data.articles : [];

  if (articles.length !== EXPECTED_ARTICLE_COUNT) {
    fail(`Expected exactly ${EXPECTED_ARTICLE_COUNT} articles in ${dataPath}, found ${articles.length}.`);
  }

  const seenIndexes = new Set();

  for (const article of articles) {
    for (const field of REQUIRED_ARTICLE_FIELDS) {
      if (field === "index") {
        if (!Number.isInteger(Number(article.index))) {
          fail(`Article is missing required numeric field: ${field}`);
        }
        continue;
      }

      if (!hasText(article[field])) {
        fail(`Article ${article.index ?? "(unknown)"} is missing required field: ${field}`);
      }
    }

    if (!hasText(extractArticleConceptPrompt(article))) {
      fail(`Article ${article.index ?? "(unknown)"} is missing required concept prompt.`);
    }

    const index = Number(article.index);

    if (index < 1 || index > EXPECTED_ARTICLE_COUNT) {
      fail(`Article index must be between 1 and ${EXPECTED_ARTICLE_COUNT}: ${index}`);
    }

    if (seenIndexes.has(index)) {
      fail(`Duplicate article index found: ${index}`);
    }

    seenIndexes.add(index);
  }

  return articles
    .map((article) => ({ ...article, index: Number(article.index) }))
    .sort((a, b) => a.index - b.index);
}

function validateStyleConfig(styleConfig, configPath) {
  if (!styleConfig || typeof styleConfig !== "object") {
    fail(`Image style config must be a JSON object: ${configPath}`);
  }

  if (!hasText(styleConfig.stylePreset)) {
    fail(`Image style config is missing stylePreset: ${configPath}`);
  }

  if (!styleConfig.presets || typeof styleConfig.presets !== "object") {
    fail(`Image style config is missing presets: ${configPath}`);
  }

  const preset = styleConfig.presets[styleConfig.stylePreset];

  if (!preset || typeof preset !== "object") {
    fail(`Selected image style preset does not exist: ${styleConfig.stylePreset}`);
  }

  if (!hasText(preset.basePrompt)) {
    fail(`Selected image style preset is missing basePrompt: ${styleConfig.stylePreset}`);
  }

  if (!Array.isArray(styleConfig.compositionRules) || styleConfig.compositionRules.length === 0) {
    fail(`Image style config must include compositionRules: ${configPath}`);
  }

  for (const rule of styleConfig.compositionRules) {
    if (!hasText(rule)) {
      fail(`Image style config contains an empty composition rule: ${configPath}`);
    }
  }

  if (!Number.isInteger(Number(styleConfig.maxPromptLength)) || Number(styleConfig.maxPromptLength) <= 0) {
    fail(`Image style config must include a positive maxPromptLength: ${configPath}`);
  }
}

function composeFinalPrompt(article, styleConfig) {
  const preset = styleConfig.presets[styleConfig.stylePreset];
  const basePrompt = preset.basePrompt.trim();
  const userStyleOverride = hasText(styleConfig.userStyleOverride) ? styleConfig.userStyleOverride.trim() : "";
  const compositionRules = styleConfig.compositionRules.map((rule) => `- ${rule.trim()}`).join("\n");
  const conceptPrompt = extractArticleConceptPrompt(article);
  const sections = [
    `Create an image using this visual style:\n${basePrompt}`
  ];

  if (userStyleOverride) {
    sections.push(`Apply this user style adjustment:\n${userStyleOverride}`);
  }

  sections.push(
    `Composition and safety rules:\n${compositionRules}`,
    `Depict this article-specific scene:\n${conceptPrompt}`
  );

  return sections.join("\n\n");
}

function hashPrompt(prompt) {
  return `sha256:${crypto.createHash("sha256").update(prompt, "utf8").digest("hex")}`;
}

function resolveConfigValue(...values) {
  for (const value of values) {
    if (hasText(value)) {
      return value.trim();
    }
  }

  return "";
}

function resolveGenerationConfig(styleConfig) {
  return {
    apiKey: process.env.NEWSLETTER_IMAGE_API_KEY || "",
    provider: resolveConfigValue(process.env.NEWSLETTER_IMAGE_PROVIDER, styleConfig.provider, "openrouter"),
    model: resolveConfigValue(
      process.env.NEWSLETTER_IMAGE_MODEL,
      styleConfig.model,
      "sourceful/riverflow-v2-fast-preview"
    )
  };
}

function assertInside(parentDir, childPath, label) {
  const resolvedParent = path.resolve(parentDir);
  const resolvedChild = path.resolve(childPath);
  const relative = path.relative(resolvedParent, resolvedChild);

  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return;
  }

  fail(`${label} resolves outside expected directory: ${resolvedChild}`);
}

function validateFinalPrompt(finalPrompt, article, styleConfig) {
  if (!hasText(finalPrompt)) {
    fail(`Article ${article.index} final prompt is empty.`);
  }

  if (finalPrompt.length > Number(styleConfig.maxPromptLength)) {
    fail(
      `Article ${article.index} final prompt is too long: ${finalPrompt.length}/${styleConfig.maxPromptLength} characters.`
    );
  }
}

function getTypeName(value) {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

function summarizeResponseShape(responseJson) {
  if (!responseJson || typeof responseJson !== "object") {
    return getTypeName(responseJson);
  }

  const parts = [`topLevelKeys=${Object.keys(responseJson).slice(0, 12).join(",") || "(none)"}`];

  if (Array.isArray(responseJson.choices)) {
    parts.push(`choices=${responseJson.choices.length}`);

    const firstChoice = responseJson.choices[0];

    if (firstChoice && typeof firstChoice === "object") {
      parts.push(`firstChoiceKeys=${Object.keys(firstChoice).slice(0, 12).join(",") || "(none)"}`);

      const message = firstChoice.message;

      if (message && typeof message === "object") {
        parts.push(`messageKeys=${Object.keys(message).slice(0, 12).join(",") || "(none)"}`);

        if (Array.isArray(message.content)) {
          const firstContent = message.content[0];
          const contentShape =
            firstContent && typeof firstContent === "object"
              ? Object.keys(firstContent).slice(0, 12).join(",") || "(none)"
              : getTypeName(firstContent);
          parts.push(`contentItems=${message.content.length}`);
          parts.push(`firstContent=${contentShape}`);
        } else {
          parts.push(`contentType=${getTypeName(message.content)}`);
        }

        if (Array.isArray(message.images)) {
          const firstImage = message.images[0];
          const imageShape =
            firstImage && typeof firstImage === "object"
              ? Object.keys(firstImage).slice(0, 12).join(",") || "(none)"
              : getTypeName(firstImage);
          parts.push(`images=${message.images.length}`);
          parts.push(`firstImage=${imageShape}`);
        }
      }
    }
  }

  return parts.join("; ");
}

function isDataImageUrl(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\//iu.test(value);
}

function hasImagePathHint(value) {
  try {
    const url = new URL(value);
    return /\.(avif|gif|jpe?g|png|webp)(?:$|\?)/iu.test(url.pathname);
  } catch {
    return false;
  }
}

function collectImageCandidates(value, pathParts = [], candidates = []) {
  const pathHint = pathParts.some((part) => /image|images|image_url|content|url/iu.test(part));

  if (typeof value === "string") {
    if (isDataImageUrl(value)) {
      candidates.push({ type: "data-url", value, priority: 0 });
    } else if (isHttpsUrl(value)) {
      candidates.push({ type: "remote-url", value, priority: pathHint ? 1 : hasImagePathHint(value) ? 2 : 3 });
    }

    return candidates;
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectImageCandidates(item, [...pathParts, String(index)], candidates);
    }

    return candidates;
  }

  if (!value || typeof value !== "object") {
    return candidates;
  }

  const preferredKeys = ["images", "image_url", "url", "content", "message", "choices"];
  const keys = Object.keys(value).sort((a, b) => {
    const aIndex = preferredKeys.indexOf(a);
    const bIndex = preferredKeys.indexOf(b);
    return (aIndex === -1 ? preferredKeys.length : aIndex) - (bIndex === -1 ? preferredKeys.length : bIndex);
  });

  for (const key of keys) {
    collectImageCandidates(value[key], [...pathParts, key], candidates);
  }

  return candidates;
}

function findImageCandidate(responseJson) {
  const candidates = collectImageCandidates(responseJson);
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0] || null;
}

function decodeDataImageUrl(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");

  if (commaIndex === -1 || !/^data:image\/[^;,]+(?:;[^,]*)?;base64,/iu.test(dataUrl.slice(0, commaIndex + 1))) {
    throw new Error("OpenRouter returned an image data URL that is not base64 encoded.");
  }

  const buffer = Buffer.from(dataUrl.slice(commaIndex + 1).replace(/\s/gu, ""), "base64");

  if (buffer.length === 0) {
    throw new Error("OpenRouter returned an empty image data URL.");
  }

  return buffer;
}

async function fetchRemoteImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OpenRouter returned an image URL that could not be fetched (${response.status} ${response.statusText}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error("OpenRouter returned an empty remote image.");
  }

  return buffer;
}

async function generateOpenRouterImage(prompt, outputPath, config) {
  if (!hasText(config.apiKey)) {
    throw new Error("Missing image generation configuration. No images generated.");
  }

  if (!hasText(config.model)) {
    throw new Error("Missing image generation model. No images generated.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://torxflow-newsletters.empty-hill-4369.workers.dev",
      "X-Title": "TorxFlow Newsletters"
    },
    body: JSON.stringify({
      model: config.model,
      modalities: ["image"],
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  const responseText = await response.text();
  let responseJson;

  try {
    responseJson = JSON.parse(responseText);
  } catch {
    throw new Error(
      `OpenRouter image generation failed (${response.status} ${response.statusText}): non-JSON response (${responseText.length} bytes).`
    );
  }

  if (!response.ok) {
    throw new Error(
      `OpenRouter image generation failed (${response.status} ${response.statusText}). Response shape: ${summarizeResponseShape(
        responseJson
      )}`
    );
  }

  const imageCandidate = findImageCandidate(responseJson);

  if (!imageCandidate) {
    throw new Error(`OpenRouter response did not contain an image. Response shape: ${summarizeResponseShape(responseJson)}`);
  }

  const imageBuffer =
    imageCandidate.type === "data-url" ? decodeDataImageUrl(imageCandidate.value) : await fetchRemoteImage(imageCandidate.value);

  await fs.writeFile(outputPath, imageBuffer);
}

async function generateImageFromPrompt(prompt, outputPath, config) {
  const provider = config.provider?.trim().toLowerCase() || "";

  if (!hasText(provider)) {
    throw new Error("Missing image generation provider. No images generated.");
  }

  if (provider === "openrouter") {
    await generateOpenRouterImage(prompt, outputPath, config);
    return;
  }

  throw new Error(
    `Image generation provider "${config.provider}" is not implemented in this repository yet. No images generated.`
  );
}

async function writeManifest(manifestPath, manifest) {
  await fs.writeFile(`${manifestPath}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.rename(`${manifestPath}.tmp`, manifestPath);
}

validateRunDate(runDate);
await loadEnvLocal(repoRoot);

const dataPath = path.join(repoRoot, "data", "newsletter-runs", `${runDate}.json`);
const styleConfigPath = path.join(repoRoot, "data", "newsletter-config", "image-style.json");
const imagesDir = path.join(repoRoot, "public", "newsletter", runDate, "images");
const manifestPath = path.join(imagesDir, "generation-manifest.json");

const data = await readJson(dataPath);
const styleConfig = await readJson(styleConfigPath);
const articles = validateArticles(data, dataPath);
validateStyleConfig(styleConfig, styleConfigPath);
const generationConfig = resolveGenerationConfig(styleConfig);

await fs.mkdir(imagesDir, { recursive: true });

const manifest = {
  runDate,
  createdAt: new Date().toISOString(),
  mode: dryRun ? "dry-run" : "generate",
  provider: generationConfig.provider,
  model: generationConfig.model,
  stylePreset: styleConfig.stylePreset,
  userStyleOverride: styleConfig.userStyleOverride?.trim() || "",
  styleConfigSnapshot: styleConfig,
  images: []
};

let failed = false;

for (const article of articles) {
  const outputPath = path.join(imagesDir, `article-${article.index}.png`);
  assertInside(imagesDir, outputPath, `Article ${article.index} output path`);

  const conceptPrompt = extractArticleConceptPrompt(article);
  const finalPrompt = composeFinalPrompt(article, styleConfig);
  validateFinalPrompt(finalPrompt, article, styleConfig);

  const manifestEntry = {
    index: article.index,
    title: article.title,
    sourceUrl: article.sourceUrl,
    conceptPrompt,
    finalPrompt,
    promptHash: hashPrompt(finalPrompt),
    outputPath: path.relative(repoRoot, outputPath).replaceAll(path.sep, "/"),
    status: dryRun ? "dry-run" : "failed",
    error: ""
  };

  try {
    if (dryRun) {
      console.log(`DRY-RUN article-${article.index}.png`);
    } else if ((await exists(outputPath)) && !force) {
      manifestEntry.status = "skipped";
      console.log(`SKIP article-${article.index}.png already exists. Use --force to overwrite.`);
    } else {
      await generateImageFromPrompt(finalPrompt, outputPath, generationConfig);
      manifestEntry.status = "generated";
      console.log(`GENERATED article-${article.index}.png`);
    }
  } catch (error) {
    failed = true;
    manifestEntry.status = "failed";
    manifestEntry.error = error.message;
    console.error(`FAIL article-${article.index}.png: ${error.message}`);
  }

  manifest.images.push(manifestEntry);
}

await writeManifest(manifestPath, manifest);

if (failed) {
  console.error(`Image generation failed. Manifest written: ${manifestPath}`);
  process.exit(1);
}

console.log(`Image generation complete. Manifest written: ${manifestPath}`);
