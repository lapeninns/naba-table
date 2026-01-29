import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

type Finding = {
  file: string;
  reason: string;
};

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "../..");

const ignoredDirs = new Set([
  ".git",
  ".next",
  "backups",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
  "tmp",
]);

const supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"]);
const focusedPattern = /\b(describe|it|test|suite)\.only\s*\(/;
const skippedPattern = /\b(describe|it|test|suite)\.skip\s*\(/;
const allowedTestNamePattern = /\.(test|spec|bench)\.[jt]sx?$/;
const allowedNonTestFiles = new Set([
  "tests/global-setup.ts",
  "tests/global-teardown.ts",
  "tests/vitest.setup.ts",
]);

const args = new Set(process.argv.slice(2));
const strictMode = !args.has("--no-strict");
const allowSkip = args.has("--allow-skip");
const jsonOutput = args.has("--json");

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      collectSourceFiles(fullPath, files);
    } else if (entry.isFile()) {
      if (!supportedExtensions.has(path.extname(entry.name))) continue;
      files.push(fullPath);
    }
  }
  return files;
}

function checkFile(filePath: string): Finding[] {
  const content = fs.readFileSync(filePath, "utf8");
  const findings: Finding[] = [];
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
  const isTestFile = allowedTestNamePattern.test(path.basename(filePath));
  const isUnderTests = relativePath.startsWith("tests/");
  const isAllowedNonTest =
    allowedNonTestFiles.has(relativePath) || relativePath.startsWith("tests/e2e/fixtures/");

  if (isUnderTests && !isTestFile && !isAllowedNonTest) {
    findings.push({
      file: filePath,
      reason: "File under tests/ must use .test/.spec/.bench naming (or be in allowlist).",
    });
  }

  if (isTestFile && focusedPattern.test(content)) {
    findings.push({ file: filePath, reason: "Focused tests detected (.only)." });
  }

  if (isTestFile && !allowSkip && skippedPattern.test(content)) {
    findings.push({ file: filePath, reason: "Skipped tests detected (.skip)." });
  }

  return findings;
}

function run(): void {
  const files = collectSourceFiles(projectRoot);
  const findings = files.flatMap(checkFile);

  const report = {
    findings: findings.map((finding) => ({
      file: path.relative(projectRoot, finding.file),
      reason: finding.reason,
    })),
    totalFilesScanned: files.length,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("Test quality checks");
    console.log("====================");
    console.log(`Scanned files: ${report.totalFilesScanned}`);
    if (report.findings.length === 0) {
      console.log("No issues found.");
    } else {
      console.log(`Findings: ${report.findings.length}`);
      for (const finding of report.findings) {
        console.log(`- ${finding.file}: ${finding.reason}`);
      }
      console.log("\nNotes:");
      console.log("- Use --allow-skip to ignore skipped tests.");
      console.log("- Use --no-strict to exit with code 0 despite findings.");
    }
  }

  if (report.findings.length > 0 && strictMode) {
    process.exitCode = 1;
  }
}

run();
