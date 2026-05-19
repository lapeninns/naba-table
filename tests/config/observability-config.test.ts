import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SENSITIVE_PATTERN =
  /(access_token|authorization|bearer|cookie|email|jwt|password|phone|secret|token)/i;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('observability config', () => {
  it('parses dashboard panels without sensitive payload fields', () => {
    const dashboard = readJson('config/observability/dashboard.json') as {
      panels?: Array<{
        title?: unknown;
        targets?: Array<{ expr?: unknown; legendFormat?: unknown }>;
        type?: unknown;
      }>;
      title?: unknown;
    };

    expect(dashboard.title).toBe('Capacity Assignment Health');
    expect(Array.isArray(dashboard.panels)).toBe(true);
    expect(dashboard.panels?.length).toBeGreaterThan(0);

    for (const panel of dashboard.panels ?? []) {
      expect(typeof panel.title).toBe('string');
      expect(typeof panel.type).toBe('string');
      expect(Array.isArray(panel.targets)).toBe(true);

      for (const target of panel.targets ?? []) {
        expect(typeof target.expr).toBe('string');
        expect(String(target.expr)).not.toMatch(SENSITIVE_PATTERN);
        expect(String(target.legendFormat ?? '')).not.toMatch(SENSITIVE_PATTERN);
      }
    }
  });

  it('parses alert configs with service and severity tags only', () => {
    const alerts = readJson('config/observability/alerts.json') as Array<{
      message?: unknown;
      name?: unknown;
      options?: Record<string, unknown>;
      query?: unknown;
      tags?: unknown;
      type?: unknown;
    }>;

    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts.length).toBeGreaterThan(0);

    for (const alert of alerts) {
      expect(typeof alert.name).toBe('string');
      expect(alert.type).toBe('query alert');
      expect(typeof alert.query).toBe('string');
      expect(typeof alert.message).toBe('string');
      expect(Array.isArray(alert.tags)).toBe(true);
      expect(alert.tags).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^service:/),
          expect.stringMatching(/^severity:/),
        ]),
      );
      expect(alert.options).toEqual(
        expect.objectContaining({
          notify_audit: false,
          notify_no_data: false,
        }),
      );
      expect(JSON.stringify(alert)).not.toMatch(SENSITIVE_PATTERN);
    }
  });
});
