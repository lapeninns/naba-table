#!/usr/bin/env tsx
/**
 * Validates commands documented in AGENTS.md are actually executable
 * Run: pnpm agents:validate
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const AGENTS_PATH = join(ROOT, 'AGENTS.md');

interface ValidationResult {
  command: string;
  valid: boolean;
  error?: string;
}

function extractCommands(content: string): string[] {
  const commands: string[] = [];
  
  // Match commands in code blocks that look like shell commands
  const codeBlockRegex = /```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const block = match[1];
    const lines = block.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Skip comments and non-command lines
      if (line.startsWith('#') || line.startsWith('//')) continue;
      
      // Look for pnpm/npm commands
      if (line.match(/^(pnpm|npm|npx)\s+/)) {
        commands.push(line.trim());
      }
    }
  }
  
  return [...new Set(commands)]; // Dedupe
}

function validateCommand(cmd: string): ValidationResult {
  // Only validate pnpm run commands that exist in package.json
  const runMatch = cmd.match(/^pnpm\s+(?:run\s+)?(\S+)/);
  if (!runMatch) {
    return { command: cmd, valid: true }; // Skip non-script commands
  }
  
  const scriptName = runMatch[1];
  
  // Skip install, dlx, and other non-script commands
  if (['install', 'dlx', 'add', 'remove', 'update', 'init'].includes(scriptName)) {
    return { command: cmd, valid: true };
  }
  
  try {
    const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const scripts = pkgJson.scripts || {};
    
    if (scripts[scriptName]) {
      return { command: cmd, valid: true };
    } else {
      return { 
        command: cmd, 
        valid: false, 
        error: `Script "${scriptName}" not found in package.json` 
      };
    }
  } catch (err) {
    return { 
      command: cmd, 
      valid: false, 
      error: `Failed to read package.json: ${err}` 
    };
  }
}

function main() {
  if (!existsSync(AGENTS_PATH)) {
    console.error('❌ AGENTS.md not found at project root');
    process.exit(1);
  }
  
  const content = readFileSync(AGENTS_PATH, 'utf-8');
  const commands = extractCommands(content);
  
  console.log(`📋 Found ${commands.length} commands in AGENTS.md\n`);
  
  const results: ValidationResult[] = commands.map(validateCommand);
  const failures = results.filter(r => !r.valid);
  
  for (const result of results) {
    if (result.valid) {
      console.log(`✅ ${result.command}`);
    } else {
      console.log(`❌ ${result.command}`);
      console.log(`   Error: ${result.error}`);
    }
  }
  
  console.log(`\n📊 Results: ${results.length - failures.length}/${results.length} commands valid`);
  
  if (failures.length > 0) {
    console.error(`\n❌ ${failures.length} command(s) failed validation`);
    process.exit(1);
  }
  
  console.log('\n✅ All documented commands are valid');
}

main();
