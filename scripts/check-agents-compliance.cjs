 /**
  * AGENTS.md Compliance Checker
  *
  * Validates:
  * 1. Root AGENTS.md exists (exact casing)
  * 2. Nested AGENTS.md files have proper frontmatter (scope: subproject, extends: path)
  * 3. Task folders have required files (research.md, plan.md, todo.md, verification.md)
  *
  * Usage: node scripts/check-agents-compliance.cjs [--fix-tasks]
  */
 
 const fs = require('fs');
 const path = require('path');
 
 const ROOT = process.cwd();
 const REQUIRED_TASK_FILES = ['research.md', 'plan.md', 'todo.md', 'verification.md'];
 const ROOT_AGENTS_LINE_BUDGET = 200;
 const NESTED_AGENTS_LINE_BUDGET = 250;
 const BANNED_SECTIONS_IN_ROOT = ['RACI', 'CODEOWNERS', '```bash\n#', 'PR_TEMPLATE'];
 
 let hasErrors = false;
 let hasWarnings = false;
 
 function error(msg) {
   console.error(`ERROR: ${msg}`);
   hasErrors = true;
 }
 
 function warn(msg) {
   console.warn(`WARN: ${msg}`);
   hasWarnings = true;
 }
 
 function info(msg) {
   console.log(`INFO: ${msg}`);
 }
 
 // 1. Check root AGENTS.md exists (exact casing)
 function checkRootAgentsMd() {
   const rootAgentsPath = path.join(ROOT, 'AGENTS.md');
   if (!fs.existsSync(rootAgentsPath)) {
     error('Missing required root /AGENTS.md (exact casing).');
     return false;
   }
   const content = fs.readFileSync(rootAgentsPath, 'utf8');
   const lineCount = content.split('\n').length;
   if (lineCount > ROOT_AGENTS_LINE_BUDGET) {
     warn(`Root AGENTS.md is ${lineCount} lines (budget: ${ROOT_AGENTS_LINE_BUDGET}). Consider moving detail to docs/agents/.`);
   }
   for (const banned of BANNED_SECTIONS_IN_ROOT) {
     if (content.includes(banned)) {
       warn(`Root AGENTS.md contains banned section pattern: "${banned}". Move to docs/ or canonical location.`);
     }
   }
   info(`Root AGENTS.md found (${lineCount} lines).`);
   return true;
   }
 
 // 2. Validate nested AGENTS.md files
 function* walkForAgentsMd(dir) {
   try {
     const entries = fs.readdirSync(dir, { withFileTypes: true });
     for (const entry of entries) {
       const fullPath = path.join(dir, entry.name);
       if (entry.isDirectory()) {
         if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
         yield* walkForAgentsMd(fullPath);
       } else if (entry.isFile() && entry.name === 'AGENTS.md') {
         if (fullPath !== path.join(ROOT, 'AGENTS.md')) {
           yield fullPath;
         }
       }
     }
   } catch {
     // Ignore permission errors
   }
 }
 
 function checkNestedAgentsMd() {
   let nestedCount = 0;
   for (const agentsPath of walkForAgentsMd(ROOT)) {
     nestedCount++;
     const content = fs.readFileSync(agentsPath, 'utf8');
     const hasScope = /scope:\s*subproject\b/.test(content);
     const hasExtends = /extends:\s+(\.\.\/)+AGENTS\.md\b/.test(content);
 
     const lineCount = content.split('\n').length;
     if (!hasScope) {
       error(`${agentsPath}: Missing 'scope: subproject' in frontmatter.`);
     }
     if (!hasExtends) {
       error(`${agentsPath}: Missing valid 'extends: ../../AGENTS.md' path in frontmatter.`);
     }
     if (lineCount > NESTED_AGENTS_LINE_BUDGET) {
       warn(`${agentsPath}: ${lineCount} lines (budget: ${NESTED_AGENTS_LINE_BUDGET}). Consider trimming.`);
     }
     if (hasScope && hasExtends) {
       info(`Nested AGENTS.md valid: ${agentsPath} (${lineCount} lines)`);
     }
   }
   if (nestedCount === 0) {
     info('No nested AGENTS.md files found (OK for non-monorepo).');
   }
 }
 
 // 3. Validate task folders
 function getTaskFolders() {
   const tasksDir = path.join(ROOT, 'tasks');
   if (!fs.existsSync(tasksDir)) {
     info('No tasks/ directory found.');
     return [];
   }
 
   const entries = fs.readdirSync(tasksDir, { withFileTypes: true });
   return entries
     .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
     .map((e) => path.join(tasksDir, e.name));
 }
 
 function checkTaskFolder(taskPath) {
   const taskName = path.basename(taskPath);
   const missingFiles = [];
 
   for (const requiredFile of REQUIRED_TASK_FILES) {
     const filePath = path.join(taskPath, requiredFile);
     if (!fs.existsSync(filePath)) {
       missingFiles.push(requiredFile);
     }
   }
 
   // Check artifacts directory exists
   const artifactsPath = path.join(taskPath, 'artifacts');
   const hasArtifacts = fs.existsSync(artifactsPath);
 
   if (missingFiles.length > 0) {
     error(`Task '${taskName}': Missing required files: ${missingFiles.join(', ')}`);
   }
 
   if (!hasArtifacts) {
     warn(`Task '${taskName}': Missing artifacts/ directory.`);
   }
 
   // Check for placeholder values in verification.md
   const verificationPath = path.join(taskPath, 'verification.md');
   if (fs.existsSync(verificationPath)) {
     const content = fs.readFileSync(verificationPath, 'utf8');
     if (content.includes('<value>') || content.includes('<issue>')) {
       warn(`Task '${taskName}': verification.md contains unfilled placeholders.`);
     }
   }
 
   if (missingFiles.length === 0 && hasArtifacts) {
     info(`Task '${taskName}': All required files present.`);
   }
 }
 
 function checkAllTaskFolders() {
   const taskFolders = getTaskFolders();
   if (taskFolders.length === 0) {
     info('No task folders to validate.');
     return;
   }
 
   info(`Found ${taskFolders.length} task folder(s).`);
   for (const taskPath of taskFolders) {
     checkTaskFolder(taskPath);
   }
 }
 
 // Main
 function main() {
   console.log('=== AGENTS.md Compliance Check ===\n');
 
   console.log('--- Checking Root AGENTS.md ---');
   checkRootAgentsMd();
   console.log('');
 
   console.log('--- Checking Nested AGENTS.md Files ---');
   checkNestedAgentsMd();
   console.log('');
 
   console.log('--- Checking Task Folders ---');
   checkAllTaskFolders();
   console.log('');
 
   console.log('=== Summary ===');
   if (hasErrors) {
     console.error('FAILED: Compliance check found errors.');
     process.exit(1);
   } else if (hasWarnings) {
     console.warn('PASSED with warnings.');
     process.exit(0);
   } else {
     console.log('PASSED: All checks passed.');
     process.exit(0);
   }
 }
 
 main();
