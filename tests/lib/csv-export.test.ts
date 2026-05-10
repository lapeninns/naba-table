import { describe, expect, it } from 'vitest';

import { escapeCSVField, generateCSV } from '@/lib/export/csv';

describe('CSV export escaping', () => {
  it('quotes normal CSV syntax characters', () => {
    expect(escapeCSVField('hello, "world"')).toBe('"hello, ""world"""');
  });

  it('prefixes formula-leading unquoted cells as literal text', () => {
    expect(escapeCSVField('=HYPERLINK("https://example.com")')).toBe(
      '"\'=HYPERLINK(""https://example.com"")"',
    );
    expect(escapeCSVField('  +SUM(1,2)')).toBe('"\'  +SUM(1,2)"');
    expect(escapeCSVField('-10')).toBe("'-10");
    expect(escapeCSVField('@cmd')).toBe("'@cmd");
  });

  it('prefixes control/whitespace before a formula trigger', () => {
    expect(escapeCSVField('\t=1+1')).toBe("'\t=1+1");
    expect(escapeCSVField('\r\n@SUM(1,2)')).toBe('"\'\r\n@SUM(1,2)"');
  });

  it('routes generated rows through the same safe helper', () => {
    const csv = generateCSV(
      [{ name: '=HYPERLINK("x")' }],
      [{ header: 'Name', accessor: (row) => row.name }],
    );
    expect(csv).toBe('Name\n"\'=HYPERLINK(""x"")"');
  });
});
