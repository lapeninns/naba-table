/**
 * Minimal YAML-subset parser sufficient for pnpm-lock.yaml (lockfileVersion 9).
 *
 * Supported: block mappings, block sequences, flow mappings `{a: b, c: d}`, flow
 * sequences `[a, b]`, single/double quoted scalars, plain scalars, comments. Everything
 * is returned as strings/arrays/objects; no type coercion. No network, no dependencies.
 */
export type YamlValue = string | YamlValue[] | { [key: string]: YamlValue };

type Line = { readonly indent: number; readonly text: string; readonly number: number };

export class LockfileParseError extends Error {
  constructor(message: string, line: number) {
    super(`pnpm-lock.yaml line ${line}: ${message}`);
    this.name = 'LockfileParseError';
  }
}

function tokenize(source: string): Line[] {
  const lines: Line[] = [];
  source.split(/\r?\n/u).forEach((raw, index) => {
    const withoutComment = stripComment(raw);
    if (withoutComment.trim().length === 0) return;
    const indent = withoutComment.length - withoutComment.trimStart().length;
    lines.push({ indent, text: withoutComment.trim(), number: index + 1 });
  });
  return lines;
}

function stripComment(raw: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (
      char === '#' &&
      !inSingle &&
      !inDouble &&
      (index === 0 || /\s/u.test(raw[index - 1] ?? ''))
    ) {
      return raw.slice(0, index);
    }
  }
  return raw;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/''/gu, "'");
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/\\"/gu, '"').replace(/\\\\/gu, '\\');
  }
  return trimmed;
}

function splitFlow(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let depth = 0;
  for (const char of body) {
    if (char === "'" && !inDouble) inSingle = !inSingle;
    else if (char === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble && (char === '{' || char === '[')) depth += 1;
    else if (!inSingle && !inDouble && (char === '}' || char === ']')) depth -= 1;
    if (char === ',' && !inSingle && !inDouble && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function splitKeyValue(text: string, lineNumber: number): { key: string; rest: string } {
  const trimmed = text.trim();
  const quote = trimmed[0];
  if (quote === "'" || quote === '"') {
    let index = 1;
    while (index < trimmed.length) {
      if (trimmed[index] === quote) {
        if (quote === "'" && trimmed[index + 1] === "'") {
          index += 2;
          continue;
        }
        break;
      }
      if (quote === '"' && trimmed[index] === '\\') index += 1;
      index += 1;
    }
    const key = unquote(trimmed.slice(0, index + 1));
    const remainder = trimmed.slice(index + 1).trimStart();
    if (!remainder.startsWith(':')) {
      throw new LockfileParseError(`expected ":" after quoted key`, lineNumber);
    }
    return { key, rest: remainder.slice(1).trim() };
  }
  const match = /^(.*?):(?:\s+(.*))?$/u.exec(trimmed);
  if (!match) throw new LockfileParseError(`expected "key: value"`, lineNumber);
  return { key: (match[1] ?? '').trim(), rest: (match[2] ?? '').trim() };
}

function parseScalarOrFlow(value: string, lineNumber: number): YamlValue {
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    if (!trimmed.endsWith('}'))
      throw new LockfileParseError('unterminated flow mapping', lineNumber);
    const result: { [key: string]: YamlValue } = {};
    for (const part of splitFlow(trimmed.slice(1, -1))) {
      const { key, rest } = splitKeyValue(part, lineNumber);
      result[key] = parseScalarOrFlow(rest, lineNumber);
    }
    return result;
  }
  if (trimmed.startsWith('[')) {
    if (!trimmed.endsWith(']'))
      throw new LockfileParseError('unterminated flow sequence', lineNumber);
    return splitFlow(trimmed.slice(1, -1)).map((part) => parseScalarOrFlow(part, lineNumber));
  }
  return unquote(trimmed);
}

function parseBlock(
  lines: Line[],
  start: number,
  indent: number,
): { value: YamlValue; next: number } {
  const first = lines[start];
  if (!first) return { value: {}, next: start };
  if (first.text.startsWith('- ') || first.text === '-') {
    return parseSequence(lines, start, indent);
  }
  return parseMapping(lines, start, indent);
}

function parseSequence(
  lines: Line[],
  start: number,
  indent: number,
): { value: YamlValue; next: number } {
  const items: YamlValue[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) break;
    if (line.indent > indent)
      throw new LockfileParseError('unexpected indentation in sequence', line.number);
    if (!(line.text.startsWith('- ') || line.text === '-')) break;
    const body = line.text === '-' ? '' : line.text.slice(2).trim();
    if (body.length === 0) {
      const nested = parseBlock(lines, index + 1, lines[index + 1]?.indent ?? indent + 1);
      items.push(nested.value);
      index = nested.next;
      continue;
    }
    items.push(parseScalarOrFlow(body, line.number));
    index += 1;
  }
  return { value: items, next: index };
}

function parseMapping(
  lines: Line[],
  start: number,
  indent: number,
): { value: YamlValue; next: number } {
  const result: { [key: string]: YamlValue } = {};
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) break;
    if (line.indent > indent)
      throw new LockfileParseError('unexpected indentation in mapping', line.number);
    const { key, rest } = splitKeyValue(line.text, line.number);
    if (rest.length === 0) {
      const nextLine = lines[index + 1];
      if (nextLine && nextLine.indent > indent) {
        const nested = parseBlock(lines, index + 1, nextLine.indent);
        result[key] = nested.value;
        index = nested.next;
      } else if (nextLine && nextLine.indent === indent && nextLine.text.startsWith('- ')) {
        const nested = parseSequence(lines, index + 1, indent);
        result[key] = nested.value;
        index = nested.next;
      } else {
        result[key] = '';
        index += 1;
      }
      continue;
    }
    result[key] = parseScalarOrFlow(rest, line.number);
    index += 1;
  }
  return { value: result, next: index };
}

export function parseYamlSubset(source: string): { [key: string]: YamlValue } {
  const lines = tokenize(source);
  if (lines.length === 0) return {};
  const parsed = parseMapping(lines, 0, lines[0]?.indent ?? 0);
  if (parsed.next !== lines.length) {
    throw new LockfileParseError(
      'trailing content could not be parsed',
      lines[parsed.next]?.number ?? 0,
    );
  }
  return parsed.value as { [key: string]: YamlValue };
}

export function isYamlMap(value: YamlValue | undefined): value is { [key: string]: YamlValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type LockfileDependency = { readonly name: string; readonly version: string };

export type LockfileImporter = {
  readonly path: string;
  readonly dependencies: readonly LockfileDependency[];
  readonly devDependencies: readonly LockfileDependency[];
  readonly optionalDependencies: readonly LockfileDependency[];
};

export type LockfilePackage = {
  readonly key: string;
  readonly name: string;
  readonly version: string;
  readonly integrity: string | null;
  readonly tarball: string | null;
};

export type LockfileSnapshot = {
  readonly key: string;
  readonly packageKey: string;
  readonly dependencies: readonly LockfileDependency[];
  readonly optionalDependencies: readonly LockfileDependency[];
};

export type ParsedLockfile = {
  readonly lockfileVersion: string;
  readonly importers: readonly LockfileImporter[];
  readonly packages: readonly LockfilePackage[];
  readonly snapshots: readonly LockfileSnapshot[];
};

/** Splits `@scope/name@1.2.3(peer@1)` into name + version; peer suffix is stripped. */
export function splitPackageKey(key: string): { name: string; version: string } {
  const withoutPeers = stripPeerSuffix(key);
  const at = withoutPeers.lastIndexOf('@');
  if (at <= 0) return { name: withoutPeers, version: '' };
  return { name: withoutPeers.slice(0, at), version: withoutPeers.slice(at + 1) };
}

export function stripPeerSuffix(value: string): string {
  const paren = value.indexOf('(');
  return paren === -1 ? value : value.slice(0, paren);
}

function readDependencyMap(value: YamlValue | undefined, nested: boolean): LockfileDependency[] {
  if (!isYamlMap(value)) return [];
  return Object.entries(value)
    .map(([name, entry]) => {
      if (nested) {
        const version = isYamlMap(entry) && typeof entry.version === 'string' ? entry.version : '';
        return { name, version };
      }
      return { name, version: typeof entry === 'string' ? entry : '' };
    })
    .filter((entry) => entry.version.length > 0);
}

export function parsePnpmLockfile(source: string): ParsedLockfile {
  const root = parseYamlSubset(source);
  const lockfileVersion = typeof root.lockfileVersion === 'string' ? root.lockfileVersion : '';
  if (!lockfileVersion.startsWith('9')) {
    throw new Error(`Unsupported pnpm lockfileVersion "${lockfileVersion}"; expected 9.x.`);
  }
  const importers: LockfileImporter[] = [];
  if (isYamlMap(root.importers)) {
    for (const [importerPath, entry] of Object.entries(root.importers)) {
      if (!isYamlMap(entry)) continue;
      importers.push({
        path: importerPath,
        dependencies: readDependencyMap(entry.dependencies, true),
        devDependencies: readDependencyMap(entry.devDependencies, true),
        optionalDependencies: readDependencyMap(entry.optionalDependencies, true),
      });
    }
  }
  const packages: LockfilePackage[] = [];
  if (isYamlMap(root.packages)) {
    for (const [key, entry] of Object.entries(root.packages)) {
      const { name, version } = splitPackageKey(key);
      const resolution = isYamlMap(entry) && isYamlMap(entry.resolution) ? entry.resolution : null;
      packages.push({
        key,
        name,
        version,
        integrity:
          resolution && typeof resolution.integrity === 'string' ? resolution.integrity : null,
        tarball: resolution && typeof resolution.tarball === 'string' ? resolution.tarball : null,
      });
    }
  }
  const snapshots: LockfileSnapshot[] = [];
  if (isYamlMap(root.snapshots)) {
    for (const [key, entry] of Object.entries(root.snapshots)) {
      snapshots.push({
        key,
        packageKey: stripPeerSuffix(key),
        dependencies: isYamlMap(entry) ? readDependencyMap(entry.dependencies, false) : [],
        optionalDependencies: isYamlMap(entry)
          ? readDependencyMap(entry.optionalDependencies, false)
          : [],
      });
    }
  }
  return { lockfileVersion, importers, packages, snapshots };
}
