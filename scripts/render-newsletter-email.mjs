import fs from "node:fs/promises";
import path from "node:path";

const runId = process.argv[2];

if (!runId) {
  console.error("Usage: node scripts/render-newsletter-email.mjs YYYY-MM-DD");
  process.exit(1);
}

const repoRoot = process.cwd();

const templatePath = path.join(repoRoot, "templates", "torxflow-news-email-template.html");
const dataPath = path.join(repoRoot, "data", "newsletter-runs", `${runId}.json`);
const outputDir = path.join(repoRoot, "public", "newsletter", runId);
const outputPath = path.join(outputDir, "email-preview.html");
const imagesDir = path.join(outputDir, "images");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDutchDateFromRunId(id) {
  const match = id.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return id;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    fail(`Could not read or parse ${filePath}: ${error.message}`);
  }
}

function getArticleByIndex(data, index) {
  const articles = Array.isArray(data.articles) ? data.articles : [];

  const byIndex = articles.find((article) => Number(article.index) === index);
  if (byIndex) return byIndex;

  const byPosition = articles[index - 1];
  if (byPosition) return byPosition;

  fail(`Missing article ${index} in ${dataPath}`);
}

function replaceToken(html, token, value) {
  return html.replaceAll(`{{${token}}}`, escapeHtml(value));
}

const templateExists = await exists(templatePath);
if (!templateExists) {
  fail(`Template missing: ${templatePath}`);
}

const data = await readJson(dataPath);

let html = await fs.readFile(templatePath, "utf8");

const publicBaseUrl =
  data.publicBaseUrl ||
  process.env.PUBLIC_BASE_URL ||
  "https://torxflow-newsletters.empty-hill-4369.workers.dev";

const newsletter = data.newsletter || {};

const replacements = {
  NEWSLETTER_TITLE: newsletter.title || "TorxFlow News",
  NEWSLETTER_SUBTITLE: newsletter.subtitle || "Nieuws voor garage-eigenaren",
  NEWSLETTER_DATE: newsletter.date || formatDutchDateFromRunId(runId),
  READ_TIME: newsletter.readTime || "4 min lezen"
};

for (const [token, value] of Object.entries(replacements)) {
  html = replaceToken(html, token, value);
}

for (let i = 1; i <= 5; i++) {
  const article = getArticleByIndex(data, i);

  const localImagePath = path.join(imagesDir, `article-${i}.jpg`);
  const localImageExists = await exists(localImagePath);

  if (!localImageExists) {
    fail(`Missing optimized image: ${localImagePath}. Run npm.cmd run images:prepare -- ${runId} first.`);
  }

  const imageUrl =
    article.imageUrl ||
    `${publicBaseUrl}/newsletter/${runId}/images/article-${i}.jpg`;

  html = replaceToken(html, `ARTICLE_${i}_IMAGE_URL`, imageUrl);
  html = replaceToken(html, `ARTICLE_${i}_IMAGE_ALT`, article.imageAlt || `TorxFlow artikel ${i}`);
  html = replaceToken(html, `ARTICLE_${i}_TITLE`, article.title || `Artikel ${i}`);
  html = replaceToken(html, `ARTICLE_${i}_SUMMARY`, article.summary || "");
}

const cta = data.cta || {};

const optionalReplacements = {
  CTA_TITLE: cta.title || "TorxFlow",
  CTA_BODY: cta.body || "",
  CTA_BUTTON_LABEL: cta.buttonLabel || "Talk to us",
  CTA_BUTTON_URL: cta.buttonUrl || "https://torxflow.com/contact"
};

for (const [token, value] of Object.entries(optionalReplacements)) {
  html = replaceToken(html, token, value);
}

const unreplacedTokens = [...new Set((html.match(/\{\{[A-Z0-9_]+\}\}/g) || []))];

if (unreplacedTokens.length > 0) {
  fail(`Unreplaced template tokens remain: ${unreplacedTokens.join(", ")}`);
}

if (html.includes("data:image")) {
  fail("Rendered email still contains data:image. Use hosted HTTPS images only.");
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, html, "utf8");

console.log(`Rendered email preview: ${outputPath}`);
console.log(`Public preview URL after deploy: ${publicBaseUrl}/newsletter/${runId}/email-preview.html`);
