import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

type UsageRecord = Map<string, Set<string>>;

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), "../..");

const envDefinitionPath = path.join(projectRoot, "lib", "env.ts");
const clientEnvDefinitionPath = path.join(projectRoot, "lib", "env-client.ts");

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

const args = new Set(process.argv.slice(2));
const strictMode = !args.has("--no-strict");
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

function parseSourceFile(filePath: string): ts.SourceFile {
  const content = fs.readFileSync(filePath, "utf8");
  const extension = path.extname(filePath);
  const scriptKind = extension === ".tsx"
    ? ts.ScriptKind.TSX
    : extension === ".jsx"
      ? ts.ScriptKind.JSX
      : extension === ".js" || extension === ".mjs" || extension === ".cjs"
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind);
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return unwrapExpression(expression.expression);
  }
  if (ts.isParenthesizedExpression(expression)) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function getPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  return null;
}

function collectLeafPaths(objectLiteral: ts.ObjectLiteralExpression, prefix: string[] = []): string[] {
  const paths: string[] = [];
  for (const property of objectLiteral.properties) {
    if (ts.isPropertyAssignment(property)) {
      const key = getPropertyName(property.name);
      if (!key) continue;
      const initializer = unwrapExpression(property.initializer);
      if (ts.isObjectLiteralExpression(initializer)) {
        paths.push(...collectLeafPaths(initializer, [...prefix, key]));
      } else {
        paths.push([...prefix, key].join("."));
      }
    } else if (ts.isShorthandPropertyAssignment(property)) {
      paths.push([...prefix, property.name.text].join("."));
    }
  }
  return paths;
}

function extractFeatureFlagPaths(): string[] {
  if (!fs.existsSync(envDefinitionPath)) {
    throw new Error(`Missing ${envDefinitionPath}`);
  }
  const source = parseSourceFile(envDefinitionPath);
  let featureFlagsObject: ts.ObjectLiteralExpression | null = null;

  const visit = (node: ts.Node): void => {
    if (ts.isGetAccessorDeclaration(node) && node.name.getText() === "featureFlags") {
      const body = node.body;
      if (!body) return;
      for (const statement of body.statements) {
        if (!ts.isReturnStatement(statement) || !statement.expression) continue;
        const expression = unwrapExpression(statement.expression);
        if (ts.isObjectLiteralExpression(expression)) {
          featureFlagsObject = expression;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);

  if (!featureFlagsObject) {
    throw new Error("Unable to locate env.featureFlags object literal.");
  }

  return collectLeafPaths(featureFlagsObject);
}

function extractClientFlagPaths(): string[] {
  if (!fs.existsSync(clientEnvDefinitionPath)) {
    throw new Error(`Missing ${clientEnvDefinitionPath}`);
  }
  const source = parseSourceFile(clientEnvDefinitionPath);
  let flagsObject: ts.ObjectLiteralExpression | null = null;

  const visit = (node: ts.Node): void => {
    if (!ts.isVariableDeclaration(node)) {
      ts.forEachChild(node, visit);
      return;
    }
    if (!ts.isIdentifier(node.name) || node.name.text !== "clientEnv") {
      ts.forEachChild(node, visit);
      return;
    }
    if (!node.initializer) return;
    const initializer = unwrapExpression(node.initializer);
    if (!ts.isObjectLiteralExpression(initializer)) return;
    for (const property of initializer.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = getPropertyName(property.name);
      if (key !== "flags") continue;
      const flagsInitializer = unwrapExpression(property.initializer);
      if (ts.isObjectLiteralExpression(flagsInitializer)) {
        flagsObject = flagsInitializer;
      }
      return;
    }
  };

  visit(source);

  if (!flagsObject) {
    throw new Error("Unable to locate clientEnv.flags object literal.");
  }

  return collectLeafPaths(flagsObject);
}

function recordUsage(record: UsageRecord, key: string, filePath: string): void {
  const entry = record.get(key) ?? new Set<string>();
  entry.add(filePath);
  record.set(key, entry);
}

function getChainFromExpression(expression: ts.Expression): string[] | null {
  const unwrapped = unwrapExpression(expression);
  if (ts.isIdentifier(unwrapped)) {
    return [unwrapped.text];
  }
  if (ts.isPropertyAccessExpression(unwrapped) || ts.isPropertyAccessChain(unwrapped)) {
    const left = getChainFromExpression(unwrapped.expression);
    if (!left) return null;
    return [...left, unwrapped.name.text];
  }
  if (ts.isElementAccessExpression(unwrapped) || ts.isElementAccessChain(unwrapped)) {
    const left = getChainFromExpression(unwrapped.expression);
    if (!left) return null;
    const argument = unwrapped.argumentExpression;
    if (argument && ts.isStringLiteral(argument)) {
      return [...left, argument.text];
    }
  }
  return null;
}

function collectBindingPaths(pattern: ts.ObjectBindingPattern, prefix: string[] = []): string[] {
  const paths: string[] = [];
  for (const element of pattern.elements) {
    if (ts.isOmittedExpression(element)) continue;
    const propertyName = element.propertyName ?? element.name;
    if (ts.isObjectBindingPattern(element.name)) {
      const key = ts.isIdentifier(propertyName)
        ? propertyName.text
        : ts.isStringLiteral(propertyName)
          ? propertyName.text
          : null;
      if (!key) continue;
      paths.push(...collectBindingPaths(element.name, [...prefix, key]));
      continue;
    }
    const key = ts.isIdentifier(propertyName)
      ? propertyName.text
      : ts.isStringLiteral(propertyName)
        ? propertyName.text
        : null;
    if (!key) continue;
    paths.push([...prefix, key].join("."));
  }
  return paths;
}

function scanUsage(files: string[]) {
  const serverUsage: UsageRecord = new Map();
  const clientUsage: UsageRecord = new Map();

  for (const filePath of files) {
    const source = parseSourceFile(filePath);

    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) {
        const chain = getChainFromExpression(node);
        if (chain && chain.length >= 3) {
          if (chain[0] === "env" && chain[1] === "featureFlags") {
            recordUsage(serverUsage, chain.slice(2).join("."), filePath);
          }
          if (chain[0] === "clientEnv" && chain[1] === "flags") {
            recordUsage(clientUsage, chain.slice(2).join("."), filePath);
          }
        }
      }

      if (ts.isElementAccessExpression(node) || ts.isElementAccessChain(node)) {
        const chain = getChainFromExpression(node);
        if (chain && chain.length >= 3) {
          if (chain[0] === "env" && chain[1] === "featureFlags") {
            recordUsage(serverUsage, chain.slice(2).join("."), filePath);
          }
          if (chain[0] === "clientEnv" && chain[1] === "flags") {
            recordUsage(clientUsage, chain.slice(2).join("."), filePath);
          }
        }
      }

      if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectBindingPattern(node.name)) {
        const chain = getChainFromExpression(node.initializer);
        if (chain?.length === 2 && chain[0] === "env" && chain[1] === "featureFlags") {
          for (const pathValue of collectBindingPaths(node.name)) {
            recordUsage(serverUsage, pathValue, filePath);
          }
        }
        if (chain?.length === 2 && chain[0] === "clientEnv" && chain[1] === "flags") {
          for (const pathValue of collectBindingPaths(node.name)) {
            recordUsage(clientUsage, pathValue, filePath);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return { serverUsage, clientUsage };
}

function buildPrefixes(paths: string[]): Set<string> {
  const prefixes = new Set<string>();
  for (const pathValue of paths) {
    const parts = pathValue.split(".");
    for (let i = 1; i <= parts.length; i += 1) {
      prefixes.add(parts.slice(0, i).join("."));
    }
  }
  return prefixes;
}

function filterUsage(record: UsageRecord, excludeFiles: Set<string>): Map<string, string[]> {
  const filtered = new Map<string, string[]>();
  for (const [pathValue, files] of record.entries()) {
    const remaining = [...files].filter((file) => !excludeFiles.has(file));
    if (remaining.length > 0) {
      filtered.set(pathValue, remaining);
    }
  }
  return filtered;
}

function isLeafUsed(leafPath: string, usedPaths: Iterable<string>): boolean {
  for (const usedPath of usedPaths) {
    if (usedPath === leafPath) return true;
    if (leafPath.startsWith(`${usedPath}.`)) return true;
  }
  return false;
}

function formatList(values: string[]): string {
  if (values.length === 0) return "(none)";
  return values.map((value) => `- ${value}`).join("\n");
}

function runAudit(): void {
  const files = collectSourceFiles(projectRoot);
  const serverFlagPaths = extractFeatureFlagPaths();
  const clientFlagPaths = extractClientFlagPaths();
  const { serverUsage, clientUsage } = scanUsage(files);

  const serverUsageFiltered = filterUsage(
    serverUsage,
    new Set([envDefinitionPath, clientEnvDefinitionPath]),
  );
  const clientUsageFiltered = filterUsage(
    clientUsage,
    new Set([envDefinitionPath, clientEnvDefinitionPath]),
  );

  const serverUsedPaths = new Set(serverUsageFiltered.keys());
  const clientUsedPaths = new Set(clientUsageFiltered.keys());

  const serverPrefixes = buildPrefixes(serverFlagPaths);
  const clientPrefixes = buildPrefixes(clientFlagPaths);

  const unusedServer = serverFlagPaths.filter((pathValue) => !isLeafUsed(pathValue, serverUsedPaths));
  const unusedClient = clientFlagPaths.filter((pathValue) => !isLeafUsed(pathValue, clientUsedPaths));

  const unknownServer = [...serverUsageFiltered.entries()]
    .filter(([pathValue]) => !serverPrefixes.has(pathValue))
    .map(([pathValue, fileList]) => ({ path: pathValue, files: fileList }));
  const unknownClient = [...clientUsageFiltered.entries()]
    .filter(([pathValue]) => !clientPrefixes.has(pathValue))
    .map(([pathValue, fileList]) => ({ path: pathValue, files: fileList }));

  const report = {
    server: {
      defined: serverFlagPaths.length,
      used: serverFlagPaths.length - unusedServer.length,
      unused: unusedServer,
      unknown: unknownServer,
    },
    client: {
      defined: clientFlagPaths.length,
      used: clientFlagPaths.length - unusedClient.length,
      unused: unusedClient,
      unknown: unknownClient,
    },
    scannedFiles: files.length,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("Feature flag audit");
    console.log("==================");
    console.log(`Scanned files: ${report.scannedFiles}`);
    console.log("\nServer feature flags");
    console.log(`- Defined: ${report.server.defined}`);
    console.log(`- Used: ${report.server.used}`);
    console.log(`- Unused: ${report.server.unused.length}`);
    console.log("Unused flag paths:");
    console.log(formatList(report.server.unused));
    console.log("\nUnknown usage:");
    if (report.server.unknown.length === 0) {
      console.log("(none)");
    } else {
      for (const entry of report.server.unknown) {
        console.log(`- ${entry.path}`);
        for (const file of entry.files) {
          console.log(`  - ${path.relative(projectRoot, file)}`);
        }
      }
    }

    console.log("\nClient feature flags");
    console.log(`- Defined: ${report.client.defined}`);
    console.log(`- Used: ${report.client.used}`);
    console.log(`- Unused: ${report.client.unused.length}`);
    console.log("Unused flag paths:");
    console.log(formatList(report.client.unused));
    console.log("\nUnknown usage:");
    if (report.client.unknown.length === 0) {
      console.log("(none)");
    } else {
      for (const entry of report.client.unknown) {
        console.log(`- ${entry.path}`);
        for (const file of entry.files) {
          console.log(`  - ${path.relative(projectRoot, file)}`);
        }
      }
    }

    console.log("\nNotes:");
    console.log("- Dynamic or aliased flag access may require manual review.");
    console.log("- Use --json for machine-readable output; --no-strict to disable failing exit code.");
  }

  const hasFindings =
    report.server.unused.length > 0 ||
    report.server.unknown.length > 0 ||
    report.client.unused.length > 0 ||
    report.client.unknown.length > 0;

  if (hasFindings && strictMode) {
    process.exitCode = 1;
  }
}

runAudit();
