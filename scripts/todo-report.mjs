#!/usr/bin/env node

/**
 * TODO/FIXME Scanner Report Generator
 *
 * Parses ripgrep JSON output and generates a tech debt report.
 * Usage: rg --json 'TODO|FIXME|HACK|XXX' ... | node scripts/todo-report.mjs
 */

import { createInterface } from 'readline';

const categories = {
  TODO: { count: 0, items: [], color: '\x1b[33m' }, // Yellow
  FIXME: { count: 0, items: [], color: '\x1b[31m' }, // Red
  HACK: { count: 0, items: [], color: '\x1b[35m' }, // Magenta
  XXX: { count: 0, items: [], color: '\x1b[31m' }, // Red
};

const reset = '\x1b[0m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';

async function main() {
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'match') {
        const path = data.data.path.text;
        const lineNum = data.data.line_number;
        const text = data.data.lines.text.trim();

        // Determine category
        for (const [key, category] of Object.entries(categories)) {
          if (text.toUpperCase().includes(key)) {
            category.count++;
            category.items.push({ path, lineNum, text });
            break;
          }
        }
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  // Generate report
  console.log('\n' + bold + '📋 Tech Debt Report' + reset);
  console.log('═'.repeat(60) + '\n');

  let totalCount = 0;

  for (const [key, category] of Object.entries(categories)) {
    totalCount += category.count;
    if (category.count > 0) {
      console.log(`${category.color}${bold}${key}${reset} ${dim}(${category.count} items)${reset}`);
      console.log('─'.repeat(40));

      for (const item of category.items.slice(0, 10)) {
        const shortPath = item.path.replace(/^(src|server|lib|components|hooks)\//, '');
        console.log(`  ${dim}${shortPath}:${item.lineNum}${reset}`);
        console.log(`    ${item.text.substring(0, 80)}${item.text.length > 80 ? '...' : ''}`);
      }

      if (category.items.length > 10) {
        console.log(`  ${dim}... and ${category.items.length - 10} more${reset}`);
      }
      console.log('');
    }
  }

  // Summary
  console.log('═'.repeat(60));
  console.log(`${bold}Total: ${totalCount} tech debt markers${reset}`);
  console.log('');

  if (totalCount > 50) {
    console.log(`${categories.FIXME.color}⚠️  High tech debt count. Consider scheduling cleanup.${reset}`);
  } else if (totalCount > 20) {
    console.log(`${categories.TODO.color}📝 Moderate tech debt. Track in backlog.${reset}`);
  } else {
    console.log(`\x1b[32m✅ Tech debt under control.${reset}`);
  }

  // Output JSON summary for CI
  const summary = {
    total: totalCount,
    breakdown: Object.fromEntries(
      Object.entries(categories).map(([key, cat]) => [key, cat.count])
    ),
    timestamp: new Date().toISOString(),
  };

  console.log(`\n${dim}JSON Summary:${reset}`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(console.error);
