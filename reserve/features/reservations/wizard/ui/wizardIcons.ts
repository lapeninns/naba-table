import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Info,
  Loader2,
  Plus,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Calendar,
  Check,
  CheckCircle: CheckCircle2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock: Clock3,
  Info,
  Loader2,
  Pencil: Edit3,
  Plus,
  Spinner: Loader2,
  User: UserRound,
  Wallet,
  X,
};

export function resolveWizardIcon(name?: string | null): LucideIcon | null {
  if (!name) return null;
  const IconComponent = ICONS[name];
  if (!IconComponent) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[wizardIcons] Missing icon mapping for "${name}".`);
    }
    return null;
  }
  return IconComponent;
}

export const defaultActionIcon = Loader2;
