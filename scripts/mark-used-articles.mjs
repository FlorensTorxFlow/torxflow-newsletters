import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RUN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const historyFile = path.join(repoRoot, "data", "newsletter-history", "used-articles.json");

function fail(message) {
  console.error(`news:mark-used failed: ${message}`);
  process.exit(1);
}

function validateRunDate(runDate) {
  if (!RUN_DATE_PATTERN.test(runDate)) {
    fail("run date is required and must use YYYY-MM-DD format");
  }

  const parsed = new Date(`${runDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== runDate) {
    fail("run date is not a valid calendar date");
  }
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(`could not read ${label} at ${filePath}: ${error.message}`);
  }
}

async function readOrCreateHistory() {
  if (!existsSync(historyFile)) {
    await mkdir(path.dirname(historyFile), { recursive: true });
    return { used: [] };
  }

  const history = await readJson(historyFile, "used article history");
  if (!history || !Array.isArray(history.used)) {
    fail(`used article history must contain a "used" array: ${historyFile}`);
  }

  return history;
}

const runDate = process.argv[2];
validateRunDate(runDate);

const runFile = path.join(repoRoot, "data", "newsletter-runs", `${runDate}.json`);
const newsletterRun = await readJson(runFile, "newsletter run");
const articles = Array.isArray(newsletterRun?.articles) ? newsletterRun.articles : [];

if (articles.length !== 5) {
  fail(`newsletter run must contain exactly 5 articles; found ${articles.length}`);
}

const now = new Date().toISOString();
const selectedArticles = articles.map((article, index) => {
  const title = compactText(article?.title);
  const sourceName = compactText(article?.sourceName);
  const sourceUrl = compactText(article?.sourceUrl);
  const publishedAt = compactText(article?.publishedAt);

  if (!title || !sourceName || !sourceUrl || !publishedAt) {
    fail(
      `article ${index + 1} must include title, sourceName, sourceUrl, and publishedAt`
    );
  }

  return {
    url: sourceUrl,
    title,
    sourceName,
    publishedAt,
    usedInRun: runDate,
    usedAt: now,
  };
});

const history = await readOrCreateHistory();
const existingUrls = new Set(
  history.used
    .map((article) => compactText(article?.url))
    .filter((url) => url.length > 0)
);

let added = 0;
for (const article of selectedArticles) {
  if (existingUrls.has(article.url)) {
    continue;
  }

  history.used.push(article);
  existingUrls.add(article.url);
  added += 1;
}

await mkdir(path.dirname(historyFile), { recursive: true });
await writeFile(historyFile, `${JSON.stringify(history, null, 2)}\n`, "utf8");

console.log(`Marked ${added} new used articles in ${historyFile}`);
