import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_ARTICLE_COUNT = 5;
const REQUIRED_ARTICLE_INDEXES = [1, 2, 3, 4, 5];
const MOJIBAKE_MARKERS = ['â', 'Â', 'Ã', '�'];
const TEMPLATE_TOKENS = ['{{', '}}'];
const PLACEHOLDER_PATTERNS = [
  /Titel artikel/i,
  /Korte introductie/i,
  /Artikel 1/i,
  /Article 1/i,
  /Lorem ipsum/i,
  /Placeholder/i,
  /TODO/i,
  /TBD/i,
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const errors = [];
const warnings = [];

function addError(field, message) {
  errors.push({ field, message });
}

function addWarning(field, message) {
  warnings.push({ field, message });
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function fieldLabel(article, field) {
  if (article && Number.isInteger(article.index)) {
    return `articles[${article.index}].${field}`;
  }
  return `articles[?].${field}`;
}

function validateRunDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    addError('runDate', 'Run date must use format YYYY-MM-DD.');
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!isValid) {
    addError('runDate', 'Run date must be a valid calendar date.');
  }

  return isValid;
}

function validateStringContent(value, field) {
  if (typeof value !== 'string') {
    return;
  }

  for (const marker of MOJIBAKE_MARKERS) {
    if (value.includes(marker)) {
      addError(field, `Contains mojibake marker "${marker}".`);
    }
  }

  for (const token of TEMPLATE_TOKENS) {
    if (value.includes(token)) {
      addError(field, `Contains unreplaced template token "${token}".`);
    }
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(value)) {
      addError(field, `Contains obvious placeholder/default copy matching ${pattern}.`);
    }
  }
}

function walkStringFields(value, fieldPath) {
  if (typeof value === 'string') {
    validateStringContent(value, fieldPath);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStringFields(item, `${fieldPath}[${index}]`));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      walkStringFields(child, fieldPath ? `${fieldPath}.${key}` : key);
    }
  }
}

function validateHttpUrl(value, field) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    addError(field, 'Must be a valid URL.');
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    addError(field, 'Protocol must be http: or https:.');
  }
}

function validateImageUrl(value, field) {
  if (!isNonemptyString(value)) {
    return;
  }

  if (value.startsWith('data:image')) {
    addError(field, 'Must not be a data:image URL.');
    return;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    addError(field, 'Must be an absolute HTTPS URL.');
    return;
  }

  if (parsed.protocol !== 'https:') {
    addError(field, 'Must use https:.');
  }
}

function validateTopLevel(run) {
  if (!isPlainObject(run.newsletter)) {
    addError('newsletter', 'newsletter object must exist.');
  } else {
    for (const field of ['title', 'subtitle', 'date', 'readTime']) {
      if (!isNonemptyString(run.newsletter[field])) {
        addError(`newsletter.${field}`, 'Must be a nonempty string.');
      }
    }
  }

  if (!Array.isArray(run.articles)) {
    addError('articles', 'articles must exist and be an array.');
  }
}

function validateArticleIndexes(articles) {
  if (articles.length !== REQUIRED_ARTICLE_COUNT) {
    addError('articles', `Must contain exactly ${REQUIRED_ARTICLE_COUNT} articles.`);
  }

  const seen = new Set();
  for (const [position, article] of articles.entries()) {
    const field = `articles[${position}].index`;
    if (!Number.isInteger(article?.index)) {
      addError(field, 'index must be an integer.');
      continue;
    }

    if (seen.has(article.index)) {
      addError(`articles[${article.index}].index`, 'Duplicate article index.');
    }
    seen.add(article.index);
  }

  const actual = [...seen].sort((a, b) => a - b);
  const expected = REQUIRED_ARTICLE_INDEXES.join(',');
  if (actual.join(',') !== expected) {
    addError('articles.indexes', `Indexes must be exactly ${expected}.`);
  }
}

function validateArticle(article, position) {
  if (!isPlainObject(article)) {
    addError(`articles[${position}]`, 'Article must be an object.');
    return;
  }

  for (const field of ['title', 'summary', 'sourceName', 'sourceUrl', 'publishedAt', 'imageAlt']) {
    if (!isNonemptyString(article[field])) {
      addError(fieldLabel(article, field), 'Must be a nonempty string.');
    }
  }

  const hasImagePrompt = isNonemptyString(article.imagePrompt);
  const hasConceptPrompt = isNonemptyString(article.image?.conceptPrompt);
  if (!hasImagePrompt && !hasConceptPrompt) {
    addError(fieldLabel(article, 'imagePrompt'), 'Must provide imagePrompt or image.conceptPrompt.');
  }

  if (isNonemptyString(article.sourceUrl)) {
    validateHttpUrl(article.sourceUrl, fieldLabel(article, 'sourceUrl'));
  }

  if ('imageUrl' in article) {
    validateImageUrl(article.imageUrl, fieldLabel(article, 'imageUrl'));
  }

  if (isPlainObject(article.image) && 'imageUrl' in article.image) {
    validateImageUrl(article.image.imageUrl, fieldLabel(article, 'image.imageUrl'));
  }

  if (isNonemptyString(article.summary)) {
    if (article.summary.length > 320) {
      addError(fieldLabel(article, 'summary'), `Summary is ${article.summary.length} characters; maximum is 320.`);
    } else if (article.summary.length > 240) {
      addWarning(fieldLabel(article, 'summary'), `Summary is ${article.summary.length} characters; recommended maximum is 240.`);
    }
  }

  if (isNonemptyString(article.title) && article.title.length > 100) {
    addWarning(fieldLabel(article, 'title'), `Title is ${article.title.length} characters; recommended maximum is 100.`);
  }
}

async function main() {
  const runDate = process.argv[2];
  if (!runDate) {
    addError('runDate', 'Usage: npm.cmd run newsletter:validate -- YYYY-MM-DD');
    printSummary(null);
    process.exit(1);
  }

  validateRunDate(runDate);

  const runPath = path.join(repoRoot, 'data', 'newsletter-runs', `${runDate}.json`);
  let run;
  try {
    const raw = await readFile(runPath, 'utf8');
    run = JSON.parse(raw);
  } catch (error) {
    addError(runPath, `Could not read or parse JSON: ${error.message}`);
    printSummary(runDate);
    process.exit(1);
  }

  if (!isPlainObject(run)) {
    addError('root', 'Newsletter run JSON must be an object.');
  } else {
    validateTopLevel(run);
    walkStringFields(run.newsletter, 'newsletter');

    if (Array.isArray(run.articles)) {
      validateArticleIndexes(run.articles);
      run.articles.forEach(validateArticle);
      run.articles.forEach((article, position) => walkStringFields(article, `articles[${article?.index ?? position}]`));
    }
  }

  printSummary(runDate);
  process.exit(errors.length > 0 ? 1 : 0);
}

function printSummary(runDate) {
  const status = errors.length > 0 ? 'FAIL' : 'PASS';
  console.log(`Newsletter run validation: ${status}${runDate ? ` (${runDate})` : ''}`);
  console.log(`Errors: ${errors.length}`);
  for (const error of errors) {
    console.log(`  - ${error.field}: ${error.message}`);
  }

  console.log(`Warnings: ${warnings.length}`);
  for (const warning of warnings) {
    console.log(`  - ${warning.field}: ${warning.message}`);
  }
}

main().catch((error) => {
  console.error(`Newsletter run validation: FAIL`);
  console.error(`Errors: 1`);
  console.error(`  - validator: ${error.message}`);
  process.exit(1);
});
