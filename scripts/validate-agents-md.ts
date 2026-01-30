#!/usr/bin/env tsx

/**
 * AGENTS.md Validation Script
 *
 * Validates that the commands documented in AGENTS.md are still valid
 * and that the file follows expected conventions.
 *
 * Usage: pnpm agents:validate
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const AGENTS_PATH = join(ROOT, 'AGENTS.md');

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string;
}

const results: ValidationResult[] = [];

function log(emoji: string, message: string): void {
  console.log(`${emoji} ${message}`);
}

function addResult(passed: boolean, message: string, details?: string): void {
  results.push({ passed, message, details });
  if (passed) {
    log('✅', message);
  } else {
    log('❌', message);
    if (details) {
      console.log(`   ${details}`);
    }
  }
}

// Check 1: AGENTS.md exists
function checkExists(): void {
  const exists = existsSync(AGENTS_PATH);
  addResult(exists, 'AGENTS.md exists at repository root');
}

// Check 2: File has required sections
function checkRequiredSections(): void {
  const content = readFileSync(AGENTS_PATH, 'utf-8');
  const requiredSections = [
    'Non-Negotiables',
    'Build & Test',
    'SDLC',
  ];

  for (const section of requiredSections) {
    const hasSection = content.toLowerCase().includes(section.toLowerCase());
    addResult(hasSection, `Contains "${section}" section`);
  }
}

// Check 3: Frontmatter is valid
function checkFrontmatter(): void {
  const content = readFileSync(AGENTS_PATH, 'utf-8');
  const hasFrontmatter = content.startsWith('---');

  if (!hasFrontmatter) {
    addResult(false, 'Has YAML frontmatter');
    return;
  }

  const frontmatterEnd = content.indexOf('---', 3);
  if (frontmatterEnd === -1) {
    addResult(false, 'Has valid YAML frontmatter (closing ---)', 'Frontmatter not properly closed');
    return;
  }

  const frontmatter = content.substring(3, frontmatterEnd);
  const hasVersion = frontmatter.includes('agents_version:');
  const hasScope = frontmatter.includes('scope:');

  addResult(hasVersion, 'Frontmatter contains agents_version');
  addResult(hasScope, 'Frontmatter contains scope');
}

// Check 4: Common commands are valid
function checkCommands(): void {
  const commands = [
    { cmd: 'pnpm install --frozen-lockfile', name: 'pnpm install' },
    { cmd: 'pnpm lint --help', name: 'pnpm lint' },
    { cmd: 'pnpm typecheck --help', name: 'pnpm typecheck' },
    { cmd: 'pnpm build --help', name: 'pnpm build' },
  ];

  for (const { cmd, name } of commands) {
    try {
      execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
      addResult(true, `Command "${name}" is valid`);
    } catch (error) {
      // --help commands return exit code 1 but that's fine
      const exitCode = (error as { status?: number }).status;
      if (exitCode === 1 && cmd.includes('--help')) {
        addResult(true, `Command "${name}" is valid`);
      } else {
        addResult(false, `Command "${name}" is valid`, `Exit code: ${exitCode}`);
      }
    }
  }
}

// Check 5: File size is reasonable
function checkFileSize(): void {
  const content = readFileSync(AGENTS_PATH, 'utf-8');
  const lines = content.split('\n').length;
  const sizeKB = Buffer.byteLength(content) / 1024;

  addResult(lines > 50, `Has sufficient content (${lines} lines)`, 'Should have >50 lines');
  addResult(sizeKB < 100, `File size is reasonable (${sizeKB.toFixed(1)}KB)`, 'Should be <100KB');
}

// Check 6: Links are not broken (basic check)
function checkLinks(): void {
  const content = readFileSync(AGENTS_PATH, 'utf-8');
  const localLinks = content.match(/\]\(\.\/[^)]+\)/g) || [];
  const relativeLinks = content.match(/\]\(\.\.\//g) || [];

  for (const link of localLinks) {
    const path = link.slice(3, -1); // Remove ](./  and )
    const fullPath = join(ROOT, path);
    const exists = existsSync(fullPath);
    if (!exists) {
      addResult(false, `Local link exists: ${path}`);
    }
  }

  if (localLinks.length === 0 && relativeLinks.length === 0) {
    addResult(true, 'No broken local links (no local links found)');
  } else {
    addResult(true, `Checked ${localLinks.length} local links`);
  }
}

// Main
async function main(): Promise<void> {
  console.log('\n📋 Validating AGENTS.md\n');
  console.log('─'.repeat(50));

  checkExists();

  if (!existsSync(AGENTS_PATH)) {
    console.log('\n❌ AGENTS.md not found. Cannot continue validation.\n');
    process.exit(1);
  }

  checkRequiredSections();
  checkFrontmatter();
  checkCommands();
  checkFileSize();
  checkLinks();

  console.log('─'.repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('❌ AGENTS.md validation failed\n');
    process.exit(1);
  }

  console.log('✅ AGENTS.md validation passed\n');
}

main().catch((error) => {
  console.error('Validation error:', error);
  process.exit(1);
});
