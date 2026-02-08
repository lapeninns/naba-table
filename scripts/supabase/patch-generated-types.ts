import fs from "node:fs";
import path from "node:path";

type PatchResult = {
  filePath: string;
  changed: boolean;
};

function findBlock(source: string, needle: string): { start: number; end: number } {
  const start = source.indexOf(needle);
  if (start < 0) {
    throw new Error(`Unable to find block start: ${needle}`);
  }

  // Walk forward and find the matching closing brace for the block that starts at the
  // first "{" after needle. This is resilient to small formatting shifts in typegen.
  const openBrace = source.indexOf("{", start);
  if (openBrace < 0) {
    throw new Error(`Unable to find opening brace after: ${needle}`);
  }

  let depth = 0;
  for (let i = openBrace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth === 0) {
      return { start, end: i + 1 };
    }
  }

  throw new Error(`Unable to find matching closing brace for: ${needle}`);
}

function patchApplyBookingStateTransition(block: string): { next: string; changed: boolean } {
  let next = block;

  // Args: allow NULL to clear timestamps / actor ids in state transitions.
  next = next.replace(/(\bp_checked_in_at:\s*)string(?!\s*\|)/g, "$1string | null");
  next = next.replace(/(\bp_checked_out_at:\s*)string(?!\s*\|)/g, "$1string | null");
  next = next.replace(/(\bp_history_changed_by:\s*)string(?!\s*\|)/g, "$1string | null");

  // Returns: mirror timestamp nullability (the function can return NULL timestamps).
  next = next.replace(/(\bchecked_in_at:\s*)string(?!\s*\|)/g, "$1string | null");
  next = next.replace(/(\bchecked_out_at:\s*)string(?!\s*\|)/g, "$1string | null");
  next = next.replace(/(\bupdated_at:\s*)string(?!\s*\|)/g, "$1string | null");

  return { next, changed: next !== block };
}

function assertPatched(block: string) {
  const required = [
    "p_checked_in_at: string | null",
    "p_checked_out_at: string | null",
    "p_history_changed_by: string | null",
    "checked_in_at: string | null",
    "checked_out_at: string | null",
    "updated_at: string | null",
  ];

  const missing = required.filter((snippet) => !block.includes(snippet));
  if (missing.length > 0) {
    throw new Error(
      `Generated types are not patched as expected for apply_booking_state_transition. Missing: ${missing.join(
        ", ",
      )}`,
    );
  }
}

export function patchGeneratedTypes(params?: { repoRoot?: string }): PatchResult {
  const repoRoot = params?.repoRoot ?? process.cwd();
  const filePath = path.join(repoRoot, "types", "supabase.ts");

  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const source = fs.readFileSync(filePath, "utf8");
  const needle = "apply_booking_state_transition: {";
  const { start, end } = findBlock(source, needle);

  const beforeBlock = source.slice(start, end);
  const { next: afterBlock, changed } = patchApplyBookingStateTransition(beforeBlock);
  assertPatched(afterBlock);

  if (!changed) {
    return { filePath, changed: false };
  }

  const nextSource = `${source.slice(0, start)}${afterBlock}${source.slice(end)}`;
  fs.writeFileSync(filePath, nextSource, "utf8");
  return { filePath, changed: true };
}

async function main() {
  const result = patchGeneratedTypes();
  // Intentionally concise: scripts may be used in CI logs.
  console.log(
    `[patch-generated-types] ${result.changed ? "patched" : "no-op"} ${path.relative(
      process.cwd(),
      result.filePath,
    )}`,
  );
}

main().catch((error) => {
  console.error("[patch-generated-types] FAILED:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});

