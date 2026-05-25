import { describe, expect, it } from 'vitest';

import {
  formatDualSyncDirectionLabel,
  formatDualSyncDirectionToken,
  getDualSyncDirectionIconKey,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncDirectionDomain';

describe('dualSyncDirectionDomain', () => {
  it('builds import direction display values', () => {
    expect(getDualSyncDirectionIconKey('import_from_google')).toBe('import');
    expect(formatDualSyncDirectionLabel('import_from_google')).toBe('Import');
    expect(formatDualSyncDirectionToken('import_from_google')).toBe('import');
  });

  it('builds export direction display values', () => {
    expect(getDualSyncDirectionIconKey('export_to_google')).toBe('export');
    expect(formatDualSyncDirectionLabel('export_to_google')).toBe('Export');
    expect(formatDualSyncDirectionToken('export_to_google')).toBe('export');
  });
});
