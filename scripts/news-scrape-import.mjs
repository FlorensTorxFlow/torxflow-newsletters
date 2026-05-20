import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INPUT_FILE =
  "C:\\TorxFlow.news-email-scrape-pipeline\\scraper\\data\\hermes\\latest-candidates.json";
const MOJIBAKE_PATTERN = /[âÂÃ�]/;
const RUN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EXPORT = 20;
const SOURCE_LIMIT = 4;
const DIVERSITY_MIN_TOTAL = 12;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(scriptDir);
const historyFile = path.join(repoRoot, "data", "newsletter-history", "used-articles.json");

function fail(message) {
  console.error(`news:import failed: ${message}`);
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

function toLlmBrief(excerpt) {
  const brief = compactText(excerpt);
  if (brief.length <= 700) {
    return brief;
  }

  return `${brief.slice(0, 697).trimEnd()}...`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(`could not read ${label} at ${filePath}: ${error.message}`);
  }
}

async function ensureUsedHistory() {
  if (!existsSync(historyFile)) {
    await mkdir(path.dirname(historyFile), { recursive: true });
    await writeFile(historyFile, `${JSON.stringify({ used: [] }, null, 2)}\n`, "utf8");
    return { used: [] };
  }

  const history = await readJson(historyFile, "used article history");
  if (!history || !Array.isArray(history.used)) {
    fail(`used article history must contain a "used" array: ${historyFile}`);
  }

  return history;
}

function isUsableCandidate(candidate, usedUrls) {
  const title = compactText(candidate.title);
  const sourceName = compactText(candidate.source_name);
  const excerpt = compactText(candidate.excerpt);
  const url = compactText(candidate.url);

  return (
    candidate.is_newsletter_candidate === true &&
    candidate.is_real_article === true &&
    candidate.page_type === "article" &&
    isHttpUrl(url) &&
    title.length > 0 &&
    sourceName.length > 0 &&
    excerpt.length > 0 &&
    !usedUrls.has(url) &&
    !MOJIBAKE_PATTERN.test(`${title} ${sourceName} ${excerpt}`)
  );
}

function toOutputArticle(candidate) {
  return {
    title: compactText(candidate.title),
    url: compactText(candidate.url),
    sourceName: compactText(candidate.source_name),
    sourceId: compactText(candidate.source_id),
    publishedAt: compactText(candidate.published_at),
    scrapedAt: compactText(candidate.scraped_at),
    excerpt: compactText(candidate.excerpt),
    llmBrief: toLlmBrief(candidate.excerpt),
    relevanceScore: Number(candidate.relevance_score) || 0,
    relevanceReasons: Array.isArray(candidate.relevance_reasons)
      ? candidate.relevance_reasons.map(compactText).filter(Boolean)
      : [],
    wordCount: Number(candidate.word_count) || 0,
    imageUrl: compactText(candidate.image_url),
  };
}

function applySourceDiversity(sortedCandidates) {
  if (sortedCandidates.length < DIVERSITY_MIN_TOTAL) {
    return sortedCandidates.slice(0, MAX_EXPORT);
  }

  const selected = [];
  const deferred = [];
  const bySource = new Map();

  for (const candidate of sortedCandidates) {
    const source = compactText(candidate.source_name).toLowerCase();
    const count = bySource.get(source) ?? 0;

    if (count < SOURCE_LIMIT && selected.length < MAX_EXPORT) {
      selected.push(candidate);
      bySource.set(source, count + 1);
    } else {
      deferred.push(candidate);
    }
  }

  for (const candidate of deferred) {
    if (selected.length >= MAX_EXPORT) {
      break;
    }
    selected.push(candidate);
  }

  return selected;
}

const runDate = process.argv[2];
validateRunDate(runDate);

const rawCandidates = await readJson(INPUT_FILE, "scraper candidates");
if (!Array.isArray(rawCandidates)) {
  fail(`scraper candidates must be a JSON array: ${INPUT_FILE}`);
}

const history = await ensureUsedHistory();
const usedUrls = new Set(
  history.used
    .map((article) => compactText(article?.url))
    .filter((url) => url.length > 0)
);

const usableCandidates = rawCandidates
  .filter((candidate) => candidate && typeof candidate === "object")
  .filter((candidate) => isUsableCandidate(candidate, usedUrls))
  .sort((a, b) => (Number(b.relevance_score) || 0) - (Number(a.relevance_score) || 0));

if (usableCandidates.length < 5) {
  fail(
    `fewer than 5 usable candidates remain after filtering (${usableCandidates.length} usable of ${rawCandidates.length} raw)`
  );
}

const exportedCandidates = applySourceDiversity(usableCandidates).map(toOutputArticle);
const output = {
  runDate,
  createdAt: new Date().toISOString(),
  inputFile: INPUT_FILE,
  candidateCountRaw: rawCandidates.length,
  candidateCountUsable: usableCandidates.length,
  candidateCountExported: exportedCandidates.length,
  articles: exportedCandidates,
};

const outputDir = path.join(repoRoot, "data", "scrapes", runDate);
const outputFile = path.join(outputDir, "articles.json");
await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(`Imported ${exportedCandidates.length} articles to ${outputFile}`);
console.log(`Raw candidates: ${rawCandidates.length}`);
console.log(`Usable candidates: ${usableCandidates.length}`);
