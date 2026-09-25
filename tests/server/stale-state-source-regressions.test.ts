import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('stale state security regressions', () => {
  it('invalidates occasion catalog cache after occasion mutations', () => {
    for (const routePath of [
      'src/app/api/ops/occasions/route.ts',
      'src/app/api/ops/occasions/[key]/route.ts',
    ]) {
      const source = readSource(routePath);
      expect(source).toContain('clearOccasionCatalogCache');
      expect(source).toContain('clearOccasionCatalogCache()');
    }
  });

  it('falls back to polling when table timeline realtime is not subscribed', () => {
    const source = readSource('src/hooks/ops/useOpsTableTimeline.ts');

    expect(source).toContain('const [realtimeHealthy, setRealtimeHealthy] = useState(false)');
    expect(source).toContain('!realtimeConfigured || !realtimeHealthy');
    expect(source).toContain("status === 'SUBSCRIBED'");
    expect(source).toContain("status === 'TIMED_OUT'");
    expect(source).toContain("status === 'CHANNEL_ERROR'");
    expect(source).toContain("status === 'CLOSED'");
  });

  it('clears availability GBP draft overrides when field keys disappear or unmount', () => {
    const source = readSource(
      'src/components/features/restaurant-settings/availability/useAvailabilityPageController.ts',
    );

    expect(source).toContain('registeredDriftKeysRef');
    expect(source).toContain('clearDriftDraftOverrides?.(stale)');
    expect(source).toContain('clearDriftDraftOverrides?.([...nextKeys])');
  });
});
