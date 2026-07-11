import { describe, expect, it } from 'vitest';

import {
  defaultActionIcon,
  resolveWizardIcon,
  wizardIconMap,
} from '@features/reservations/wizard/ui/wizardIcons';

describe('resolveWizardIcon', () => {
  it('resolves every mapped icon name @contract @smoke', () => {
    for (const name of Object.keys(wizardIconMap)) {
      expect(resolveWizardIcon(name)).toBe(wizardIconMap[name]);
    }
  });

  it('resolves the aliases used by wizard step actions @contract', () => {
    // Step actions reference these names; a missing mapping renders no icon.
    for (const alias of ['ChevronLeft', 'Check', 'Plus', 'Pencil', 'Spinner']) {
      expect(resolveWizardIcon(alias)).toBeTruthy();
    }
  });

  it('returns null for unknown or empty names @contract', () => {
    expect(resolveWizardIcon('NotARealIcon')).toBeNull();
    expect(resolveWizardIcon('')).toBeNull();
    expect(resolveWizardIcon(null)).toBeNull();
    expect(resolveWizardIcon(undefined)).toBeNull();
  });

  it('exports a loader as the default action icon @contract', () => {
    expect(defaultActionIcon).toBe(wizardIconMap.Loader2);
  });
});
