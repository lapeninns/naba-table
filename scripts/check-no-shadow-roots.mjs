#!/usr/bin/env node

/**
 * Guard against cross-root component shadowing.
 *
 * `@/components/*` resolves through two physical roots, root-first:
 *   "@/components/*": ["./components/*", "./src/components/*"]
 *
 * When the SAME relative path exists under both roots, `./components/<p>`
 * silently wins and `./src/components/<p>` becomes unreachable dead code that
 * can drift from the version everyone actually imports (this bit us with
 * ui/calendar.tsx and ui/copy-button.tsx). This check fails CI if any such
 * collision exists so the two trees can never fork again.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ROOT_A = 'components';
const ROOT_B = 'src/components';
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function collectRelPaths(rootDir) {
  const abs = path.join(ROOT, rootDir);
  const out = new Set();
  if (!fs.existsSync(abs)) return out;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (EXTS.has(path.extname(entry.name))) {
        out.add(path.relative(abs, full).split(path.sep).join('/'));
      }
    }
  };
  walk(abs);
  return out;
}

const a = collectRelPaths(ROOT_A);
const b = collectRelPaths(ROOT_B);
const collisions = [...a].filter((p) => b.has(p)).sort();

if (collisions.length > 0) {
  console.error(
    `\n✗ Cross-root component shadowing detected: ${collisions.length} path(s) exist under BOTH ` +
      `${ROOT_A}/ and ${ROOT_B}/.\n` +
      `  Because @/components/* resolves ${ROOT_A}/ first, the ${ROOT_B}/ copy is unreachable and will drift.\n` +
      `  Keep one canonical file per relative path:\n`,
  );
  for (const p of collisions) {
    console.error(`    - ${ROOT_A}/${p}  ⟵ wins   |   ${ROOT_B}/${p}  ⟵ shadowed`);
  }
  console.error('');
  process.exit(1);
}

console.log(
  `✓ No cross-root component shadowing (${a.size} in ${ROOT_A}/, ${b.size} in ${ROOT_B}/, 0 collisions).`,
);
