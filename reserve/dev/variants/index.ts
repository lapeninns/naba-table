import { WizardNavA } from './WizardNavA';
import { WizardNavB } from './WizardNavB';
import { WizardNavC } from './WizardNavC';
import { WizardNavigation } from '../../features/reservations/wizard/ui/WizardNavigation';

import type { WizardNavVariantProps } from './shared';
import type { ComponentType } from 'react';

export type VariantKey = 'current' | 'a' | 'b' | 'c';

export interface VariantEntry {
  key: VariantKey;
  label: string;
  blurb: string;
  Component: ComponentType<WizardNavVariantProps>;
}

export const VARIANTS: VariantEntry[] = [
  { key: 'current', label: 'Current', blurb: 'shipped baseline', Component: WizardNavigation },
  { key: 'a', label: 'A · Dock', blurb: 'action-first', Component: WizardNavA },
  { key: 'b', label: 'B · Stepper', blurb: 'progress-forward', Component: WizardNavB },
  { key: 'c', label: 'C · Sheet', blurb: 'summary reveal', Component: WizardNavC },
];

export function variantEntry(key: string): VariantEntry {
  return VARIANTS.find((v) => v.key === key) ?? VARIANTS[0];
}
