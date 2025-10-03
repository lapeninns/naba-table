#!/usr/bin/env node
/**
 * Guard Script: Prevent shadcn/ui Creep
 * 
 * This script detects any shadcn-related artifacts that might be accidentally
 * added to the project. Run this in CI/CD or pre-commit hooks.
 * 
 * Exits with code 1 if any shadcn artifacts are detected.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const ERRORS = [];

// ============================================
// CHECK 1: components.json should not exist
// ============================================
const componentsJsonPath = join(rootDir, 'components.json');
if (existsSync(componentsJsonPath)) {
  ERRORS.push('❌ BLOCKED: components.json detected (shadcn configuration file)');
  ERRORS.push('   Remove it with: rm components.json');
}

// ============================================
// CHECK 2: No @radix-ui/* in package.json
// ============================================
const packageJsonPath = join(rootDir, 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const allDeps = {
    ...packageJson.dependencies || {},
    ...packageJson.devDependencies || {}
  };
  
  const radixPackages = Object.keys(allDeps).filter(dep => dep.startsWith('@radix-ui/'));
  if (radixPackages.length > 0) {
    ERRORS.push('❌ BLOCKED: Radix UI packages detected (used by shadcn/ui):');
    radixPackages.forEach(pkg => {
      ERRORS.push(`   - ${pkg}`);
    });
    ERRORS.push('   Remove them with: pnpm remove ' + radixPackages.join(' '));
  }
}

// ============================================
// CHECK 3: No shadcn-specific dependencies
// ============================================
const FORBIDDEN_DEPS = [
  'class-variance-authority',
  'tailwind-merge',
  'clsx'
];

if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const allDeps = {
    ...packageJson.dependencies || {},
    ...packageJson.devDependencies || {}
  };
  
  const forbiddenFound = FORBIDDEN_DEPS.filter(dep => dep in allDeps);
  if (forbiddenFound.length > 0) {
    ERRORS.push('❌ BLOCKED: shadcn-specific dependencies detected:');
    forbiddenFound.forEach(pkg => {
      ERRORS.push(`   - ${pkg} (typically used with shadcn/ui)`);
    });
    ERRORS.push('   Remove them with: pnpm remove ' + forbiddenFound.join(' '));
    ERRORS.push('   Note: This project uses a custom cn() utility instead.');
  }
}

// ============================================
// CHECK 4: No shadcn import patterns in code
// ============================================
// (Optional - can be slow on large codebases)
// Uncomment if you want to scan source files:
/*
import { execSync } from 'child_process';

try {
  const grepResult = execSync(
    'grep -r "from [\'\\"]@/components/ui/" app/ components/ reserve/ 2>/dev/null || true',
    { cwd: rootDir, encoding: 'utf-8' }
  );
  
  if (grepResult.trim()) {
    ERRORS.push('❌ BLOCKED: Detected shadcn import pattern:');
    ERRORS.push('   Files importing from @/components/ui/:');
    grepResult.trim().split('\n').slice(0, 5).forEach(line => {
      ERRORS.push(`   ${line}`);
    });
    if (grepResult.trim().split('\n').length > 5) {
      ERRORS.push('   ... and more');
    }
  }
} catch (err) {
  // grep not found or error - skip this check
}
*/

// ============================================
// REPORT RESULTS
// ============================================
console.log('\n🛡️  shadcn/ui Guard Check\n');

if (ERRORS.length === 0) {
  console.log('✅ PASS: No shadcn/ui artifacts detected');
  console.log('   Your project is clean!\n');
  process.exit(0);
} else {
  console.log('🚫 FAIL: shadcn/ui artifacts detected\n');
  ERRORS.forEach(err => console.log(err));
  console.log('\n📝 Why this matters:');
  console.log('   This project uses a custom UI stack (daisyUI + Headless UI + custom components).');
  console.log('   Adding shadcn/ui would create confusion and unnecessary dependencies.\n');
  console.log('💡 If you need UI components:');
  console.log('   - Use daisyUI for standard components');
  console.log('   - Use Headless UI for interactive primitives');
  console.log('   - Build custom components for unique needs\n');
  process.exit(1);
}
