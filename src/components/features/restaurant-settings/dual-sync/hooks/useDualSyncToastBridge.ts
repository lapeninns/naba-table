import { useCallback } from 'react';
import { toast } from 'sonner';

import type { DualSyncToastIntent } from '../dualSyncShellActionDomain';

export function useDualSyncToastBridge() {
  return useCallback((intent: DualSyncToastIntent) => {
    toast[intent.kind](intent.message);
  }, []);
}
