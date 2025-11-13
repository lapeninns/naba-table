import fs from "node:fs";
import path from "node:path";

const inputPath = path.resolve(process.cwd(), ".env.local");
const outputPath = path.resolve(process.cwd(), ".env.local.example");

if (!fs.existsSync(inputPath)) {
  console.error("Missing .env.local — cannot generate example file.");
  process.exit(1);
}

const content = fs.readFileSync(inputPath, "utf8");
const lines = content.split(/\r?\n/);

const header = [
  "# -----------------------------------------------------------------------------",
  "# AUTO-GENERATED: sync from .env.local without secrets",
  "# Run `pnpm tsx scripts/generate-env-local-example.ts` after editing .env.local.",
  "# Never commit real secrets; this file intentionally blanks values.",
  "# -----------------------------------------------------------------------------",
  "",
];

const sanitized = lines.map((line) => {
  const trimmed = line.trim();

  if (!trimmed) return "";
  if (trimmed.startsWith("#")) return line;

  const equalsIndex = line.indexOf("=");
  if (equalsIndex === -1) return line;

  const key = line.slice(0, equalsIndex).trim();
  const inlineCommentIndex = line.indexOf("#", equalsIndex);
  const inlineComment = inlineCommentIndex >= 0 ? ` ${line.slice(inlineCommentIndex).trimEnd()}` : "";

  return `${key}=${inlineComment}`.trimEnd();
});

const output = [...header, ...sanitized].join("\n").concat("\n");
fs.writeFileSync(outputPath, output, "utf8");

console.log(`Synced ${outputPath} from ${inputPath} (${sanitized.length} lines).`);
