#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

import { InventoryInputError, parseArgs } from './gbp-inventory-cli.mjs';
import {
  CONTENT_FIELD,
  MUTATION_NAMES,
  PROVIDER_GROUP_FIELD,
  PROVIDER_GROUP_PATH,
  SKIP_DIRECTORY,
  SOURCE_EXTENSIONS,
  STORAGE_PATH,
  STRONG_CONTENT_FIELD,
} from './gbp-inventory-patterns.mjs';

async function sourceFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !SKIP_DIRECTORY.test(entry.name))
      .map(async (entry) => {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(root, absolute);
        const relative = path.relative(root, absolute).split(path.sep).join('/');
        return SOURCE_EXTENSIONS.test(entry.name) || relative.endsWith('.sql') ? [relative] : [];
      }),
  );
  return nested.flat().sort();
}

function calleeName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isCallExpression(expression)) {
    const called = calleeName(expression.expression);
    return called ? `${called}()` : '';
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const parent = calleeName(expression.expression);
    return parent ? `${parent}.${expression.name.text}` : expression.name.text;
  }
  return '';
}

function propertyName(node) {
  const name = node.name;
  if (!name) return '';
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text;
  return '';
}

function addCandidate(census, candidate) {
  const current = census.get(candidate.signature);
  if (current) {
    current.count += 1;
    current.lines.push(candidate.line);
    return;
  }
  census.set(candidate.signature, { ...candidate, count: 1, lines: [candidate.line] });
}

function scanTypeScript(relativePath, sourceText, census) {
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true);
  let googleEndpointContext = false;
  const findGoogleContext = (node) => {
    if (
      ts.isStringLiteral(node) &&
      /(?:mybusiness|businessprofile).*googleapis\.com/i.test(node.text)
    ) {
      googleEndpointContext = true;
    }
    ts.forEachChild(node, findGoogleContext);
  };
  findGoogleContext(source);
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const symbol = calleeName(node.expression);
      const leaf = symbol.split('.').at(-1) ?? '';
      const directClientMutation =
        symbol.includes('.') &&
        /(?:(?:google|gbp).*?(?:listing|food.?menus)|locations)/i.test(symbol) &&
        /^(?:create|delete|patch|replace|update)(?:\w+)?$/i.test(leaf);
      const method = node
        .getText(source)
        .match(/method\s*:\s*['"](PATCH|POST|PUT|DELETE)['"]/i)?.[1]
        ?.toUpperCase();
      const transportMutation =
        Boolean(method) &&
        (googleEndpointContext ||
          /(?:google|gbp)/i.test(symbol) ||
          /^server\/google-business-profile\/client[^/]*\.ts$/i.test(relativePath));
      if (MUTATION_NAMES.test(leaf) || directClientMutation || transportMutation) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const mutationSymbol = transportMutation ? `${symbol}:${method}` : symbol;
        addCandidate(census, {
          kind: 'mutation',
          signature: `${relativePath}#${mutationSymbol}`,
          path: relativePath,
          symbol: mutationSymbol,
          line,
        });
      }
    }
    const isContentNode =
      ts.isPropertyAssignment(node) ||
      ts.isShorthandPropertyAssignment(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isParameter(node);
    if (isContentNode) {
      const field = propertyName(node);
      if (
        field &&
        (STRONG_CONTENT_FIELD.test(field) ||
          (PROVIDER_GROUP_PATH.test(relativePath) && PROVIDER_GROUP_FIELD.test(field)) ||
          (STORAGE_PATH.test(relativePath) && CONTENT_FIELD.test(field)))
      ) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        addCandidate(census, {
          kind: 'content',
          signature: `${relativePath}#${field}`,
          path: relativePath,
          field,
          line,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function scanSql(relativePath, sourceText, census) {
  const column =
    /(?:^|[(,])\s*"?([a-z][a-z0-9_]*)"?\s+(?:jsonb?|text|varchar|character|uuid|timestamp|boolean|integer|bigint|numeric)(?=\s|,|\))/gim;
  for (const match of sourceText.matchAll(column)) {
    const field = match[1] ?? '';
    if (
      !STRONG_CONTENT_FIELD.test(field) &&
      !(PROVIDER_GROUP_PATH.test(relativePath) && PROVIDER_GROUP_FIELD.test(field)) &&
      !(STORAGE_PATH.test(relativePath) && CONTENT_FIELD.test(field))
    )
      continue;
    const offset = (match.index ?? 0) + match[0].indexOf(field);
    const line = sourceText.slice(0, offset).split('\n').length;
    addCandidate(census, {
      kind: 'content',
      signature: `${relativePath}#${field}`,
      path: relativePath,
      field,
      line,
    });
  }
}

function parseManifest(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InventoryInputError(
      `malformed manifest JSON: ${error instanceof Error ? error.message : 'unknown parse error'}`,
    );
  }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    throw new InventoryInputError('manifest must contain version 1 and an entries array');
  }
  const entries = new Map();
  for (const entry of parsed.entries) {
    const valid =
      entry &&
      (entry.kind === 'mutation' || entry.kind === 'content') &&
      typeof entry.signature === 'string' &&
      typeof entry.owner === 'string' &&
      typeof entry.category === 'string' &&
      typeof entry.retentionAction === 'string' &&
      ['controlled', 'known-unsafe', 'storage'].includes(entry.classification) &&
      Number.isInteger(entry.expectedCount) &&
      entry.expectedCount > 0;
    if (!valid || entries.has(entry?.signature)) {
      throw new InventoryInputError(
        'manifest entries require unique signatures, owner/category/retentionAction/classification, and positive expectedCount',
      );
    }
    entries.set(entry.signature, entry);
  }
  return entries;
}

async function scanInventory({ root, manifestPath }) {
  const files = await sourceFiles(root);
  const census = new Map();
  for (const relativePath of files) {
    const sourceText = await readFile(path.join(root, relativePath), 'utf8');
    if (relativePath.endsWith('.sql')) scanSql(relativePath, sourceText, census);
    else scanTypeScript(relativePath, sourceText, census);
  }
  const manifest = parseManifest(await readFile(path.resolve(root, manifestPath), 'utf8'));
  const candidates = [...census.values()].sort((left, right) =>
    left.signature.localeCompare(right.signature),
  );
  const unknowns = candidates.filter((candidate) => !manifest.has(candidate.signature));
  const stale = [...manifest.values()]
    .filter((entry) => census.get(entry.signature)?.count !== entry.expectedCount)
    .map((entry) => ({
      signature: entry.signature,
      expectedCount: entry.expectedCount,
      actualCount: census.get(entry.signature)?.count ?? 0,
    }))
    .sort((left, right) => left.signature.localeCompare(right.signature));
  const matched = candidates
    .filter((candidate) => manifest.get(candidate.signature)?.expectedCount === candidate.count)
    .map((candidate) => ({ ...candidate, ...manifest.get(candidate.signature) }));
  return {
    ok: unknowns.length === 0 && stale.length === 0 && candidates.length > 0,
    counts: {
      filesScanned: files.length,
      mutationCandidates: candidates.filter((item) => item.kind === 'mutation').length,
      contentCandidates: candidates.filter((item) => item.kind === 'content').length,
      matched: matched.length,
      unknown: unknowns.length,
      stale: stale.length,
    },
    matched,
    unknowns,
    stale,
    methodology:
      'Repository-wide TypeScript AST call/property census plus SQL column patterns; strong Google/provider/external content names are fail-closed everywhere, with broader content patterns on known persistence surfaces. Allowlist matching is exact by path and symbol/field with occurrence counts.',
  };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = await scanInventory({
      root: path.resolve(args.root),
      manifestPath: args.manifest,
    });
    if (result.counts.mutationCandidates === 0 && result.counts.contentCandidates === 0) {
      process.stdout.write(
        `${JSON.stringify({ ...result, error: 'zero mutation candidates and zero content candidates; refusing misleading success' }, null, 2)}\n`,
      );
      process.exitCode = 2;
      return;
    }
    process.stdout.write(
      `${JSON.stringify({ ...result, exitCode: result.ok ? 0 : 1 }, null, 2)}\n`,
    );
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown scanner failure';
    process.stdout.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
    process.exitCode = 2;
  }
}

await main();
