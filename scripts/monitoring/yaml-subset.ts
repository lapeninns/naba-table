/**
 * Tiny YAML subset parser with zero dependencies, used by the standalone
 * monitoring scripts (`pnpm ops:verify`, `pnpm ops:slo-evidence`) so they run
 * with node built-ins plus `tsx` only.
 *
 * Supported: comments, nested block maps, block sequences of scalars and of
 * maps (`- key: value` with sibling keys indented under the dash), inline
 * arrays of scalars (`[a, "b", 3]`), quoted and unquoted scalars, numbers,
 * booleans, and null. Not supported: anchors, aliases, multi-line scalars,
 * flow maps, tabs for indentation.
 */

export type YamlValue = string | number | boolean | null | YamlValue[] | YamlMap;

export type YamlMap = { [key: string]: YamlValue };

type Line = {
  readonly indent: number;
  readonly text: string;
  readonly lineNumber: number;
};

export class YamlSubsetError extends Error {
  constructor(
    message: string,
    readonly lineNumber: number,
  ) {
    super(`YAML subset: ${message} (line ${lineNumber})`);
    this.name = 'YamlSubsetError';
  }
}

function stripComment(raw: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '#' && (index === 0 || /\s/u.test(raw[index - 1] ?? ''))) {
      return raw.slice(0, index);
    }
  }
  return raw;
}

function tokenize(source: string): Line[] {
  const lines: Line[] = [];
  source.split(/\r?\n/u).forEach((raw, offset) => {
    const lineNumber = offset + 1;
    if (raw.includes('\t')) {
      throw new YamlSubsetError('tabs are not allowed', lineNumber);
    }
    const withoutComment = stripComment(raw);
    const text = withoutComment.trim();
    if (text.length === 0 || text === '---' || text === '...') return;
    const indent = withoutComment.length - withoutComment.trimStart().length;
    lines.push({ indent, text, lineNumber });
  });
  return lines;
}

function parseQuoted(raw: string, lineNumber: number): string {
  if (raw.startsWith('"')) {
    if (!raw.endsWith('"') || raw.length < 2) {
      throw new YamlSubsetError('unterminated double-quoted string', lineNumber);
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'string') throw new Error('not a string');
      return parsed;
    } catch {
      throw new YamlSubsetError('invalid double-quoted string', lineNumber);
    }
  }
  if (!raw.endsWith("'") || raw.length < 2) {
    throw new YamlSubsetError('unterminated single-quoted string', lineNumber);
  }
  return raw.slice(1, -1).replace(/''/gu, "'");
}

function splitInlineArray(body: string, lineNumber: number): string[] {
  const items: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (const char of body) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === '[' || char === ']' || char === '{' || char === '}') {
      throw new YamlSubsetError('nested flow collections are not supported', lineNumber);
    }
    if (char === ',') {
      items.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (quote) throw new YamlSubsetError('unterminated quoted string in array', lineNumber);
  if (current.trim().length > 0 || items.length > 0) items.push(current.trim());
  return items.filter((item, index) => item.length > 0 || index < items.length - 1);
}

export function parseScalar(raw: string, lineNumber = 0): YamlValue {
  const value = raw.trim();
  if (value.startsWith('"') || value.startsWith("'")) return parseQuoted(value, lineNumber);
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new YamlSubsetError('unterminated inline array', lineNumber);
    const body = value.slice(1, -1).trim();
    if (body.length === 0) return [];
    return splitInlineArray(body, lineNumber).map((item) => {
      if (item.length === 0) throw new YamlSubsetError('empty inline array item', lineNumber);
      return parseScalar(item, lineNumber);
    });
  }
  if (value.startsWith('{')) {
    throw new YamlSubsetError('flow maps are not supported', lineNumber);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) return Number(value);
  return value;
}

const KEY_PATTERN = /^([A-Za-z0-9_][A-Za-z0-9_.\-/ ]*?):(?:\s+(.*))?$/u;

function splitKey(text: string, lineNumber: number): { key: string; rest: string } | null {
  const match = KEY_PATTERN.exec(text);
  if (!match) return null;
  const key = match[1]?.trim() ?? '';
  if (key.length === 0) throw new YamlSubsetError('empty map key', lineNumber);
  return { key, rest: (match[2] ?? '').trim() };
}

function looksLikeMapEntry(text: string): boolean {
  return KEY_PATTERN.test(text) && !text.startsWith('[') && !/^["']/u.test(text);
}

type ParseResult = { value: YamlValue; next: number };

function parseNode(lines: Line[], index: number): ParseResult {
  const line = lines[index];
  if (!line) return { value: null, next: index };
  if (line.text === '-' || line.text.startsWith('- ')) {
    return parseSequence(lines, index, line.indent);
  }
  return parseMap(lines, index, line.indent);
}

function parseMap(lines: Line[], start: number, indent: number): ParseResult {
  const result: YamlMap = Object.create(null) as YamlMap;
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) break;
    if (line.indent > indent) {
      throw new YamlSubsetError('unexpected indentation', line.lineNumber);
    }
    if (line.text === '-' || line.text.startsWith('- ')) {
      throw new YamlSubsetError('sequence item inside a map', line.lineNumber);
    }
    const entry = splitKey(line.text, line.lineNumber);
    if (!entry) throw new YamlSubsetError('expected `key: value`', line.lineNumber);
    if (Object.prototype.hasOwnProperty.call(result, entry.key)) {
      throw new YamlSubsetError(`duplicate key "${entry.key}"`, line.lineNumber);
    }
    if (entry.rest.length > 0) {
      result[entry.key] = parseScalar(entry.rest, line.lineNumber);
      index += 1;
      continue;
    }
    const nextLine = lines[index + 1];
    if (nextLine && nextLine.indent > indent) {
      const child = parseNode(lines, index + 1);
      result[entry.key] = child.value;
      index = child.next;
      continue;
    }
    result[entry.key] = null;
    index += 1;
  }
  return { value: result, next: index };
}

function parseSequence(lines: Line[], start: number, indent: number): ParseResult {
  const items: YamlValue[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index];
    if (!line || line.indent < indent) break;
    if (line.indent > indent) {
      throw new YamlSubsetError('unexpected indentation in sequence', line.lineNumber);
    }
    if (!(line.text === '-' || line.text.startsWith('- '))) break;

    const rest = line.text.slice(1).trim();
    if (rest.length === 0) {
      const nextLine = lines[index + 1];
      if (nextLine && nextLine.indent > indent) {
        const child = parseNode(lines, index + 1);
        items.push(child.value);
        index = child.next;
      } else {
        items.push(null);
        index += 1;
      }
      continue;
    }

    if (looksLikeMapEntry(rest)) {
      const childIndent = indent + (line.text.length - rest.length);
      let end = index + 1;
      while (end < lines.length && (lines[end]?.indent ?? 0) > indent) end += 1;
      const block: Line[] = [
        { indent: childIndent, text: rest, lineNumber: line.lineNumber },
        ...lines.slice(index + 1, end),
      ];
      const child = parseMap(block, 0, childIndent);
      if (child.next !== block.length) {
        const offending = block[child.next];
        throw new YamlSubsetError(
          'unexpected content in sequence item',
          offending?.lineNumber ?? line.lineNumber,
        );
      }
      items.push(child.value);
      index = end;
      continue;
    }

    items.push(parseScalar(rest, line.lineNumber));
    index += 1;
  }
  return { value: items, next: index };
}

export function parseYamlSubset(source: string): YamlValue {
  const lines = tokenize(source);
  if (lines.length === 0) return null;
  const first = lines[0];
  if (first && first.indent !== 0) {
    throw new YamlSubsetError('document must start at column 0', first.lineNumber);
  }
  const parsed = parseNode(lines, 0);
  if (parsed.next !== lines.length) {
    const offending = lines[parsed.next];
    throw new YamlSubsetError('unexpected trailing content', offending?.lineNumber ?? 0);
  }
  return parsed.value;
}

export function isYamlMap(value: YamlValue | undefined): value is YamlMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
