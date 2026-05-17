import { spawnSync } from "node:child_process";

const runId = process.argv[2];

if (!runId) {
  console.error("Usage: node scripts/prepare-newsletter-images.mjs YYYY-MM-DD");
  process.exit(1);
}

function runNodeScript(scriptPath) {
  const result = spawnSync("node", [scriptPath, runId], {
    stdio: "inherit",
    shell: false
  });

  return result.status === 0;
}

console.log(`Preparing newsletter images for ${runId}...`);

console.log("\nAttempt 1: optimize");
const optimize1 = runNodeScript("scripts/optimize-newsletter-images.mjs");

console.log("\nAttempt 1: validate");
const validate1 = optimize1 && runNodeScript("scripts/validate-newsletter-images.mjs");

if (validate1) {
  console.log("\nNewsletter image preparation passed.");
  process.exit(0);
}

console.warn("\nNewsletter image validation failed. Running one recovery attempt only.");

console.log("\nAttempt 2: optimize");
const optimize2 = runNodeScript("scripts/optimize-newsletter-images.mjs");

console.log("\nAttempt 2: validate");
const validate2 = optimize2 && runNodeScript("scripts/validate-newsletter-images.mjs");

if (validate2) {
  console.log("\nNewsletter image preparation passed after one recovery attempt.");
  process.exit(0);
}

console.error("\nNewsletter image preparation failed after one recovery attempt.");
console.error("STOP: Do not commit, push, fill template, or send email.");
process.exit(1);
